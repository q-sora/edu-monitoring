"""
services/anomaly_scanner.py
─────────────────────────────────────────────────────────────────────────────
Intelligent anomaly detection across all 6 education data spheres.

Pipeline:
  1. For each sphere, aggregate metrics by (region, year) via SQL.
  2. Compute Z-score across all regions for each (metric, year).
  3. Flag outliers: |z| ≥ 2.5 → critical, ≥ 1.8 → warning, ≥ 1.3 → info.
  4. Also flag large YoY changes (≥ 40% critical, ≥ 25% warning).
  5. Build 5-year trend series for sparklines.
  6. Call Gemini Pro to generate business-language explanations.
  7. Persist to anomaly_reports table.

Gemini prompt role: "Financial auditor explaining data deviations."
Returns JSON: {summary, reasons: [3 items], recommendation, context}
"""
from __future__ import annotations

import json
import logging
import math
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.gemini_client import GeminiAPIError, gemini_post
from app.core.gemini_models import (
    GEMINI_BASE_URL,
    GeminiTask,
    get_generation_config,
    get_model_for,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Severity thresholds
# ─────────────────────────────────────────────────────────────────────────────

_Z_CRITICAL = 2.5
_Z_WARNING  = 1.8
_Z_INFO     = 1.3
_YOY_CRITICAL = 40.0  # % change
_YOY_WARNING  = 25.0

_SPHERE_LABELS = {
    "contingent": "Контингент",
    "finance":    "Финансирование",
    "science":    "Наука",
    "graduates":  "Выпускники",
    "education":  "Образовательный процесс",
}

_METRIC_LABELS: dict[str, str] = {
    # contingent
    "total_count":          "Общий контингент",
    "budget_share_pct":     "Доля бюджетников, %",
    "budget_count":         "Бюджетный контингент",
    # finance
    "annual_budget":        "Годовой бюджет",
    "payroll_share_pct":    "Доля ФОТ в бюджете, %",
    "expenses_payroll":     "Расходы на ФОТ",
    "per_capita_norm":      "Норма подушевого финансирования",
    # science
    "publications_scopus":  "Публикации Scopus",
    "hirsch_index_avg":     "Средний индекс Хирша",
    "publications_wos":     "Публикации WoS",
    # graduates
    "employed_6m_pct":      "Трудоустройство 6 мес., %",
    "graduates_total":      "Выпускники (всего)",
    "employed_12m_pct":     "Трудоустройство 12 мес., %",
    # education
    "mandatory_programs_count": "Обязательных программ",
    "startup_projects_count":   "Стартап-проектов",
}


# ─────────────────────────────────────────────────────────────────────────────
# Internal data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class _RegionPoint:
    region_id:   int
    region_name: str
    year:        int
    value:       float


@dataclass
class DetectedAnomaly:
    sphere:        str
    region_id:     int
    region_name:   str
    year:          int
    metric_name:   str
    metric_label:  str
    raw_value:     float
    expected_value: float
    deviation_pct: float
    z_score:       float
    severity:      str
    trend:         list[dict]   # [{year, value, national_avg}]


# ─────────────────────────────────────────────────────────────────────────────
# Statistical helpers
# ─────────────────────────────────────────────────────────────────────────────

def _z_score(v: float, mean: float, std: float) -> Optional[float]:
    if std == 0:
        return None
    return (v - mean) / std


def _classify_z(z: Optional[float]) -> Optional[str]:
    if z is None:
        return None
    az = abs(z)
    if az >= _Z_CRITICAL:
        return "critical"
    if az >= _Z_WARNING:
        return "warning"
    if az >= _Z_INFO:
        return "info"
    return None


def _classify_yoy(delta_pct: float) -> Optional[str]:
    a = abs(delta_pct)
    if a >= _YOY_CRITICAL:
        return "critical"
    if a >= _YOY_WARNING:
        return "warning"
    return None


def _compute_anomalies(
    sphere: str,
    metric_name: str,
    points: list[_RegionPoint],
    trend_map: dict[tuple[int, int], list[dict]],  # (region_id, year) → trend
) -> list[DetectedAnomaly]:
    """
    Given a list of (region, year, value) points, compute Z-scores across
    regions for each year and flag outliers.
    """
    label = _METRIC_LABELS.get(metric_name, metric_name)
    results: list[DetectedAnomaly] = []

    years = sorted({p.year for p in points})
    for year in years:
        year_points = [p for p in points if p.year == year]
        if len(year_points) < 4:
            continue  # not enough data for meaningful statistics

        values = [p.value for p in year_points]
        mean = statistics.mean(values)
        try:
            std = statistics.stdev(values)
        except statistics.StatisticsError:
            std = 0.0

        for pt in year_points:
            z = _z_score(pt.value, mean, std)
            sev = _classify_z(z)
            if sev is None:
                continue

            dev = ((pt.value - mean) / mean * 100) if mean != 0 else 0.0
            trend = trend_map.get((pt.region_id, year), [])

            results.append(DetectedAnomaly(
                sphere        = sphere,
                region_id     = pt.region_id,
                region_name   = pt.region_name,
                year          = year,
                metric_name   = metric_name,
                metric_label  = label,
                raw_value     = round(pt.value, 4),
                expected_value= round(mean, 4),
                deviation_pct = round(dev, 2),
                z_score       = round(z, 3) if z is not None else 0.0,
                severity      = sev,
                trend         = trend,
            ))

    # Also check YoY changes per region
    region_ids = {p.region_id for p in points}
    for rid in region_ids:
        rpts = sorted([p for p in points if p.region_id == rid], key=lambda x: x.year)
        for i in range(1, len(rpts)):
            prev, curr = rpts[i-1], rpts[i]
            if prev.value == 0:
                continue
            delta = (curr.value - prev.value) / abs(prev.value) * 100
            sev = _classify_yoy(delta)
            if sev is None:
                continue

            # Don't double-count if already flagged by z-score
            already = any(
                a.region_id == rid and a.year == curr.year and a.metric_name == metric_name
                for a in results
            )
            if already:
                continue

            trend = trend_map.get((rid, curr.year), [])
            results.append(DetectedAnomaly(
                sphere        = sphere,
                region_id     = rid,
                region_name   = curr.region_name,
                year          = curr.year,
                metric_name   = metric_name,
                metric_label  = label,
                raw_value     = round(curr.value, 4),
                expected_value= round(prev.value, 4),
                deviation_pct = round(delta, 2),
                z_score       = 0.0,
                severity      = sev,
                trend         = trend,
            ))

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Data loaders — one per sphere
# ─────────────────────────────────────────────────────────────────────────────

async def _load_contingent(
    db: AsyncSession,
    years: list[int],
) -> dict[str, list[_RegionPoint]]:
    """Aggregate contingent metrics by (region, year)."""
    sql = text("""
        SELECT
            o.region_id,
            r.name_ru AS region_name,
            EXTRACT(YEAR FROM cs.snapshot_date)::int AS year,
            SUM(cs.total_count)        AS total_count,
            SUM(cs.budget_count)       AS budget_count,
            SUM(cs.total_count)        AS total_for_share
        FROM contingent_snapshots cs
        JOIN organizations o   ON o.id = cs.org_id
        JOIN regions r         ON r.id = o.region_id
        WHERE cs.deleted_at IS NULL
          AND o.region_id IS NOT NULL
          AND EXTRACT(YEAR FROM cs.snapshot_date) = ANY(:years)
        GROUP BY o.region_id, r.name_ru, EXTRACT(YEAR FROM cs.snapshot_date)
        HAVING SUM(cs.total_count) > 0
        ORDER BY year, o.region_id
    """)
    rows = (await db.execute(sql, {"years": years})).fetchall()

    tc_points, bs_points = [], []
    trend_map: dict[str, dict[tuple[int, int], list[dict]]] = {
        "total_count": {}, "budget_share_pct": {},
    }

    # Build basic points
    by_region_year: dict[tuple[int, int], dict] = {}
    for row in rows:
        rid, rname, year, total, budget, _ = row
        if total:
            tc_points.append(_RegionPoint(rid, rname, year, float(total)))
        if total and budget is not None:
            bs_points.append(_RegionPoint(rid, rname, year, float(budget) / float(total) * 100))
        by_region_year[(rid, year)] = {"total": float(total or 0), "budget": float(budget or 0), "region_name": rname}

    # Build trend
    for (rid, year), data in by_region_year.items():
        nat_avg_total = statistics.mean([
            v["total"] for (r, y), v in by_region_year.items() if y == year
        ]) if by_region_year else 0
        trend_map["total_count"][(rid, year)] = [
            {"year": year, "value": data["total"], "national_avg": round(nat_avg_total, 0)}
        ]
        nat_avg_share = statistics.mean([
            v["budget"] / v["total"] * 100 for (r, y), v in by_region_year.items()
            if y == year and v["total"] > 0
        ]) if by_region_year else 0
        bs_val = data["budget"] / data["total"] * 100 if data["total"] > 0 else 0
        trend_map["budget_share_pct"][(rid, year)] = [
            {"year": year, "value": round(bs_val, 2), "national_avg": round(nat_avg_share, 2)}
        ]

    return {
        "total_count":      (tc_points, trend_map["total_count"]),
        "budget_share_pct": (bs_points, trend_map["budget_share_pct"]),
    }


async def _load_finance(
    db: AsyncSession,
    years: list[int],
) -> dict[str, tuple[list[_RegionPoint], dict]]:
    sql = text("""
        SELECT
            o.region_id,
            r.name_ru AS region_name,
            fr.period_year AS year,
            SUM(fr.annual_budget)      AS annual_budget,
            SUM(fr.expenses_payroll)   AS expenses_payroll,
            AVG(fr.per_capita_norm)    AS per_capita_norm
        FROM finance_records fr
        JOIN organizations o   ON o.id = fr.org_id
        JOIN regions r         ON r.id = o.region_id
        WHERE fr.deleted_at IS NULL
          AND o.region_id IS NOT NULL
          AND fr.period_year = ANY(:years)
          AND fr.annual_budget > 0
        GROUP BY o.region_id, r.name_ru, fr.period_year
        ORDER BY year, o.region_id
    """)
    rows = (await db.execute(sql, {"years": years})).fetchall()

    ab_points, ps_points, pc_points = [], [], []
    trend_ab: dict[tuple[int, int], list[dict]] = {}
    trend_ps: dict[tuple[int, int], list[dict]] = {}
    trend_pc: dict[tuple[int, int], list[dict]] = {}

    by_ry: dict[tuple[int, int], dict] = {}
    for row in rows:
        rid, rname, year, budget, payroll, percap = row
        budget  = float(budget  or 0)
        payroll = float(payroll or 0)
        percap  = float(percap  or 0)
        by_ry[(rid, year)] = {
            "budget": budget, "payroll": payroll, "percap": percap, "rname": rname,
        }
        if budget > 0:
            ab_points.append(_RegionPoint(rid, rname, year, budget))
        if budget > 0 and payroll > 0:
            ps_points.append(_RegionPoint(rid, rname, year, payroll / budget * 100))
        if percap > 0:
            pc_points.append(_RegionPoint(rid, rname, year, percap))

    for (rid, year), d in by_ry.items():
        nat_ab = statistics.mean([
            v["budget"] for (r, y), v in by_ry.items() if y == year and v["budget"] > 0
        ] or [0])
        trend_ab[(rid, year)] = [{"year": year, "value": d["budget"], "national_avg": round(nat_ab, 0)}]

        ps_vals = [v["payroll"] / v["budget"] * 100 for (r, y), v in by_ry.items()
                   if y == year and v["budget"] > 0]
        nat_ps = statistics.mean(ps_vals) if ps_vals else 0
        ps_val = d["payroll"] / d["budget"] * 100 if d["budget"] > 0 else 0
        trend_ps[(rid, year)] = [{"year": year, "value": round(ps_val, 2), "national_avg": round(nat_ps, 2)}]

        nat_pc = statistics.mean([
            v["percap"] for (r, y), v in by_ry.items() if y == year and v["percap"] > 0
        ] or [0])
        trend_pc[(rid, year)] = [{"year": year, "value": d["percap"], "national_avg": round(nat_pc, 2)}]

    return {
        "annual_budget":     (ab_points, trend_ab),
        "payroll_share_pct": (ps_points, trend_ps),
        "per_capita_norm":   (pc_points, trend_pc),
    }


async def _load_science(
    db: AsyncSession,
    years: list[int],
) -> dict[str, tuple[list[_RegionPoint], dict]]:
    sql = text("""
        SELECT
            o.region_id,
            r.name_ru AS region_name,
            sa.period_year AS year,
            SUM(sa.publications_scopus) AS publications_scopus,
            AVG(sa.hirsch_index_avg)    AS hirsch_index_avg,
            SUM(sa.publications_wos)    AS publications_wos
        FROM science_activity sa
        JOIN organizations o   ON o.id = sa.org_id
        JOIN regions r         ON r.id = o.region_id
        WHERE sa.deleted_at IS NULL
          AND o.region_id IS NOT NULL
          AND sa.period_year = ANY(:years)
        GROUP BY o.region_id, r.name_ru, sa.period_year
        ORDER BY year, o.region_id
    """)
    rows = (await db.execute(sql, {"years": years})).fetchall()

    sc_pts, hi_pts, wos_pts = [], [], []
    trend_sc: dict[tuple[int, int], list[dict]] = {}
    trend_hi: dict[tuple[int, int], list[dict]] = {}

    by_ry: dict[tuple[int, int], dict] = {}
    for row in rows:
        rid, rname, year, scopus, hirsch, wos = row
        scopus = float(scopus or 0)
        hirsch = float(hirsch or 0)
        wos    = float(wos    or 0)
        by_ry[(rid, year)] = {"scopus": scopus, "hirsch": hirsch, "wos": wos, "rname": rname}
        if scopus > 0:
            sc_pts.append(_RegionPoint(rid, rname, year, scopus))
        if hirsch > 0:
            hi_pts.append(_RegionPoint(rid, rname, year, hirsch))
        if wos > 0:
            wos_pts.append(_RegionPoint(rid, rname, year, wos))

    for (rid, year), d in by_ry.items():
        nat_sc = statistics.mean([
            v["scopus"] for (r, y), v in by_ry.items() if y == year and v["scopus"] > 0
        ] or [0])
        trend_sc[(rid, year)] = [{"year": year, "value": d["scopus"], "national_avg": round(nat_sc, 0)}]

        nat_hi = statistics.mean([
            v["hirsch"] for (r, y), v in by_ry.items() if y == year and v["hirsch"] > 0
        ] or [0])
        trend_hi[(rid, year)] = [{"year": year, "value": d["hirsch"], "national_avg": round(nat_hi, 2)}]

    return {
        "publications_scopus": (sc_pts, trend_sc),
        "hirsch_index_avg":    (hi_pts, trend_hi),
    }


async def _load_graduates(
    db: AsyncSession,
    years: list[int],
) -> dict[str, tuple[list[_RegionPoint], dict]]:
    sql = text("""
        SELECT
            o.region_id,
            r.name_ru AS region_name,
            gr.graduation_year AS year,
            SUM(gr.graduates_total)        AS graduates_total,
            AVG(gr.employed_6m_pct)        AS employed_6m_pct,
            AVG(gr.employed_12m_pct)       AS employed_12m_pct
        FROM graduates_records gr
        JOIN organizations o   ON o.id = gr.org_id
        JOIN regions r         ON r.id = o.region_id
        WHERE gr.deleted_at IS NULL
          AND o.region_id IS NOT NULL
          AND gr.graduation_year = ANY(:years)
        GROUP BY o.region_id, r.name_ru, gr.graduation_year
        ORDER BY year, o.region_id
    """)
    rows = (await db.execute(sql, {"years": years})).fetchall()

    gt_pts, e6_pts, e12_pts = [], [], []
    trend_e6: dict[tuple[int, int], list[dict]] = {}
    trend_gt: dict[tuple[int, int], list[dict]] = {}

    by_ry: dict[tuple[int, int], dict] = {}
    for row in rows:
        rid, rname, year, grad_total, emp6, emp12 = row
        gt   = float(grad_total or 0)
        e6   = float(emp6       or 0)
        e12  = float(emp12      or 0)
        by_ry[(rid, year)] = {"gt": gt, "e6": e6, "e12": e12, "rname": rname}
        if gt > 0:
            gt_pts.append(_RegionPoint(rid, rname, year, gt))
        if e6 > 0:
            e6_pts.append(_RegionPoint(rid, rname, year, e6))

    for (rid, year), d in by_ry.items():
        nat_e6 = statistics.mean([
            v["e6"] for (r, y), v in by_ry.items() if y == year and v["e6"] > 0
        ] or [0])
        trend_e6[(rid, year)] = [{"year": year, "value": d["e6"], "national_avg": round(nat_e6, 2)}]

        nat_gt = statistics.mean([
            v["gt"] for (r, y), v in by_ry.items() if y == year and v["gt"] > 0
        ] or [0])
        trend_gt[(rid, year)] = [{"year": year, "value": d["gt"], "national_avg": round(nat_gt, 0)}]

    return {
        "employed_6m_pct": (e6_pts, trend_e6),
        "graduates_total": (gt_pts, trend_gt),
    }


async def _load_education(
    db: AsyncSession,
    years: list[int],
) -> dict[str, tuple[list[_RegionPoint], dict]]:
    # educational_process uses snapshot_date, not period_year
    sql = text("""
        SELECT
            o.region_id,
            r.name_ru AS region_name,
            EXTRACT(YEAR FROM ep.snapshot_date)::int AS year,
            SUM(ep.mandatory_programs_count) AS mandatory_programs_count,
            SUM(ep.startup_projects_count)   AS startup_projects_count
        FROM educational_process ep
        JOIN organizations o   ON o.id = ep.org_id
        JOIN regions r         ON r.id = o.region_id
        WHERE ep.deleted_at IS NULL
          AND o.region_id IS NOT NULL
          AND EXTRACT(YEAR FROM ep.snapshot_date) = ANY(:years)
        GROUP BY o.region_id, r.name_ru, EXTRACT(YEAR FROM ep.snapshot_date)
        ORDER BY year, o.region_id
    """)
    rows = (await db.execute(sql, {"years": years})).fetchall()

    mp_pts, sp_pts = [], []
    trend_mp: dict[tuple[int, int], list[dict]] = {}
    by_ry: dict[tuple[int, int], dict] = {}

    for row in rows:
        rid, rname, year, mp, sp = row
        mp = float(mp or 0)
        sp = float(sp or 0)
        by_ry[(rid, year)] = {"mp": mp, "sp": sp, "rname": rname}
        if mp > 0:
            mp_pts.append(_RegionPoint(rid, rname, year, mp))
        if sp > 0:
            sp_pts.append(_RegionPoint(rid, rname, year, sp))

    for (rid, year), d in by_ry.items():
        nat_mp = statistics.mean([
            v["mp"] for (r, y), v in by_ry.items() if y == year and v["mp"] > 0
        ] or [0])
        trend_mp[(rid, year)] = [{"year": year, "value": d["mp"], "national_avg": round(nat_mp, 0)}]

    return {
        "mandatory_programs_count": (mp_pts, trend_mp),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Gemini AI explanation
# ─────────────────────────────────────────────────────────────────────────────

_SYSTEM_AUDITOR = """Ты — старший финансовый аудитор, специализирующийся на государственных
программах образования Казахстана. Твоя задача — объяснять статистические отклонения
бизнес-языком: без паники, сухо и по факту.

Тебе будет предоставлен выброс данных по одному показателю в одном регионе.
Ответь строго в JSON-формате (без markdown-оберток):
{
  "summary": "Одно предложение — что произошло",
  "reasons": ["Причина 1", "Причина 2", "Причина 3"],
  "recommendation": "Одна конкретная рекомендация для руководства",
  "context": "Дополнительный контекст (1-2 предложения о типичности ситуации)"
}"""


async def _explain_with_gemini(
    anomaly: DetectedAnomaly,
    api_key: str,
) -> Optional[dict]:
    """Call Gemini Pro to generate business explanation for one anomaly."""
    direction = "выше" if anomaly.deviation_pct > 0 else "ниже"
    abs_dev = abs(anomaly.deviation_pct)

    user_prompt = f"""
Сфера: {_SPHERE_LABELS.get(anomaly.sphere, anomaly.sphere)}
Регион: {anomaly.region_name}
Год: {anomaly.year}
Показатель: {anomaly.metric_label}
Фактическое значение: {anomaly.raw_value:,.2f}
Ожидаемое значение (среднее по регионам): {anomaly.expected_value:,.2f}
Отклонение: {'+' if anomaly.deviation_pct > 0 else ''}{anomaly.deviation_pct:.1f}% ({direction} среднего на {abs_dev:.1f}%)
Z-оценка: {anomaly.z_score:.2f}

Тренд (последние наблюдения): {json.dumps(anomaly.trend, ensure_ascii=False)}

Объясни эту аномалию бизнес-языком. Почему значение показателя «{anomaly.metric_label}»
в регионе «{anomaly.region_name}» за {anomaly.year} год может так сильно отличаться
от среднего по системе? Напиши 3 возможные причины и 1 рекомендацию.
""".strip()

    model = get_model_for(GeminiTask.INSIGHT_FULL).value
    url   = GEMINI_BASE_URL.format(model=model)
    cfg   = get_generation_config(GeminiTask.INSIGHT_FULL, json_mode=True)

    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM_AUDITOR}]},
        "contents":           [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig":   cfg,
    }

    try:
        text_out = await gemini_post(url, api_key, payload, timeout=60.0)
        return json.loads(text_out)

    except (GeminiAPIError, json.JSONDecodeError, Exception) as exc:
        logger.warning("Gemini explanation failed for %s/%s/%d: %s",
                       anomaly.sphere, anomaly.metric_name, anomaly.region_id, exc)
        return {
            "summary": f"Отклонение {anomaly.deviation_pct:+.1f}% от среднего по регионам",
            "reasons": [
                "Статистический выброс — значение выходит за 2σ от среднего",
                "Возможна ошибка ввода данных — рекомендуется верификация",
                "Структурные изменения в регионе (новые организации, реорганизация)",
            ],
            "recommendation": "Запросить объяснение у регионального координатора",
            "context": "AI-объяснение временно недоступно. Данные требуют ручной проверки.",
        }


# ─────────────────────────────────────────────────────────────────────────────
# Main scanner
# ─────────────────────────────────────────────────────────────────────────────

class AnomalyScanner:
    """
    Entry point for the weekly anomaly scan.

    Usage:
        scanner = AnomalyScanner(db, api_key)
        count = await scanner.run(years=[2023, 2024])
    """

    def __init__(self, db: AsyncSession, api_key: str):
        self.db      = db
        self.api_key = api_key

    async def run(self, years: Optional[list[int]] = None) -> int:
        """
        Scan all spheres for the given years (default: last 2 years).
        Returns count of anomalies persisted.
        """
        if not years:
            current = datetime.now(timezone.utc).year
            years = [current - 1, current]

        logger.info("AnomalyScanner: scanning years=%s", years)

        loaders = [
            ("contingent", _load_contingent),
            ("finance",    _load_finance),
            ("science",    _load_science),
            ("graduates",  _load_graduates),
            ("education",  _load_education),
        ]

        all_anomalies: list[DetectedAnomaly] = []

        for sphere, loader in loaders:
            try:
                metrics = await loader(self.db, years)
                for metric_name, (points, trend_map) in metrics.items():
                    if not points:
                        continue
                    found = _compute_anomalies(sphere, metric_name, points, trend_map)
                    all_anomalies.extend(found)
                    logger.debug("  %s.%s → %d anomalies", sphere, metric_name, len(found))
            except Exception as exc:
                logger.warning("Loader failed for sphere=%s: %s", sphere, exc)

        logger.info("AnomalyScanner: found %d raw anomalies", len(all_anomalies))

        # Sort by severity (critical first), limit to top 20 per run for API quota
        sev_order = {"critical": 0, "warning": 1, "info": 2}
        all_anomalies.sort(key=lambda a: (sev_order.get(a.severity, 9), -abs(a.deviation_pct)))
        to_process = all_anomalies[:20]

        scan_run_at = datetime.now(timezone.utc)
        persisted = 0
        BATCH = 5

        for i, anomaly in enumerate(to_process):
            explanation = await _explain_with_gemini(anomaly, self.api_key)
            try:
                await self._persist(anomaly, explanation, scan_run_at)
                persisted += 1
            except Exception as exc:
                logger.warning("Failed to persist anomaly: %s", exc)
            # Commit every BATCH inserts so partial results survive a timeout
            if (i + 1) % BATCH == 0:
                await self.db.commit()

        await self.db.commit()
        logger.info("AnomalyScanner: persisted %d anomaly records", persisted)
        return persisted

    async def _persist(
        self,
        a: DetectedAnomaly,
        explanation: Optional[dict],
        scan_run_at: datetime,
    ) -> None:
        await self.db.execute(
            text("""
                INSERT INTO anomaly_reports
                    (sphere, region_id, year, severity, metric_name, metric_label,
                     raw_value, expected_value, deviation_pct, z_score,
                     trend_json, ai_explanation_json, status, scan_run_at, created_at)
                VALUES
                    (:sphere, :region_id, :year, :severity, :metric_name, :metric_label,
                     :raw_value, :expected_value, :deviation_pct, :z_score,
                     CAST(:trend AS jsonb), CAST(:explanation AS jsonb),
                     'new', :scan_run_at, NOW())
                ON CONFLICT (sphere, region_id, year, metric_name)
                DO UPDATE SET
                    severity            = EXCLUDED.severity,
                    raw_value           = EXCLUDED.raw_value,
                    deviation_pct       = EXCLUDED.deviation_pct,
                    z_score             = EXCLUDED.z_score,
                    trend_json          = EXCLUDED.trend_json,
                    ai_explanation_json = EXCLUDED.ai_explanation_json
            """),
            {
                "sphere":       a.sphere,
                "region_id":    a.region_id,
                "year":         a.year,
                "severity":     a.severity,
                "metric_name":  a.metric_name,
                "metric_label": a.metric_label,
                "raw_value":    a.raw_value,
                "expected_value": a.expected_value,
                "deviation_pct":  a.deviation_pct,
                "z_score":        a.z_score,
                "trend":          json.dumps(a.trend, ensure_ascii=False),
                "explanation":    json.dumps(explanation, ensure_ascii=False) if explanation else "null",
                "scan_run_at":    scan_run_at,
            },
        )
