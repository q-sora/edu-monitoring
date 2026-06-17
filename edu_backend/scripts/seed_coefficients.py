"""
seed_coefficients.py
────────────────────
Заполняет coefficient_records (2020-2025) для всех организаций.
Определяет education_level по org_type_id организации.

Аномалии (по заданию):
 - Кдо1 2020: 2-3 ДО организации с освоением < 0.70 (COVID)
 - Кдо13 2022: 1 ДО организация с текучестью > 25%
 - Ктпп10 2023: 1 ТиППО организация с трудоустройством < 0.45
 - Квпо19 2024: 1 ВиПО организация с эффективностью расходов < 0.60
"""
from __future__ import annotations

import asyncio
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import engine_write

random.seed(20260101)

# Маппинг org_type кода → education_level
ORG_TYPE_LEVEL = {
    "ДО":    "DO",
    "ДопО":  "DOP",
    "СО":    "SO",
    "ТиППО": "TPPO",
    "ВиПО":  "VIPO",
}

SUPERADMIN_ID = "5222215e-4fa6-4f9b-b3d2-8d783e5993da"

PRINCIPLES = [
    "transparency",
    "self_development",
    "financial_stability",
    "safety",
    "investment_appeal",
]

PRINCIPLE_WEIGHTS = {
    "transparency": 0.25,
    "self_development": 0.25,
    "financial_stability": 0.25,
    "safety": 0.15,
    "investment_appeal": 0.10,
}

STATUS_SCORE = {"excellent": 100, "normal": 75, "warning": 40, "critical": 0}


def rnd(lo, hi): return random.uniform(lo, hi)


def calc(formula_type: str, num: float, den: float) -> float:
    if formula_type == "ratio":
        return num / den if den else 0.0
    if formula_type == "percentage":
        return (num / den * 100) if den else 0.0
    if formula_type == "inverse":
        return 1.0 - (num / den) if den else 1.0
    if formula_type == "boolean":
        return 1.0 if num >= 1 else 0.0
    if formula_type == "growth":
        return (num - den) / den if den else 0.0
    return 0.0


def status(value, norm_min, norm_max, norm_target, formula_type: str) -> str:
    if formula_type == "inverse":
        if value >= 0.98: return "excellent"
        if value >= 0.90: return "normal"
        if value >= 0.80: return "warning"
        return "critical"
    if formula_type == "boolean":
        return "excellent" if value == 1.0 else "critical"
    if norm_target is not None:
        t = float(norm_target)
        if t == 0:
            return "excellent" if value == 0 else ("warning" if value <= 0.1 else "critical")
        diff = abs(value - t) / t
        if diff <= 0.05: return "excellent"
        if diff <= 0.15: return "normal"
        if diff <= 0.30: return "warning"
        return "critical"
    if norm_min is not None and norm_max is not None:
        mn, mx = float(norm_min), float(norm_max)
        if mn <= value <= mx: return "normal"
        if value < mn * 0.85 or value > mx * 1.15: return "critical"
        return "warning"
    if norm_min is not None:
        mn = float(norm_min)
        if value >= mn * 1.10: return "excellent"
        if value >= mn: return "normal"
        if value >= mn * 0.80: return "warning"
        return "critical"
    if norm_max is not None:
        mx = float(norm_max)
        if value <= mx * 0.80: return "excellent"
        if value <= mx: return "normal"
        if value <= mx * 1.20: return "warning"
        return "critical"
    return "normal"


def gen_pair(defn: dict, year: int, org_idx: int, anomaly: float | None = None) -> tuple[float, float]:
    """
    Генерирует (числитель, знаменатель) для коэффициента.
    anomaly — если не None, форсирует ratio/percentage в это значение.
    """
    ft = defn["formula_type"]
    code = defn["code"]

    # Базовый тренд: COVID 2020 -10%, потом +2%/год
    covid = 0.90 if year == 2020 else 1.0
    trend = 1.0 + (year - 2020) * 0.02
    noise = rnd(0.95, 1.05)
    base = covid * trend * noise

    if ft == "boolean":
        # 90% chance of 1, reduced in 2020
        prob = 0.75 if year == 2020 else 0.90
        n = 1.0 if random.random() < prob else 0.0
        return (n, 1.0)

    if ft == "inverse":
        # Small fine / debt ratio → numerator is small
        fine_ratio = rnd(0.001, 0.03) / base
        den = rnd(1e7, 1e9)
        return (fine_ratio * den, den)

    if ft == "growth":
        prev = rnd(1000, 5000)
        growth = rnd(-0.05, 0.10) * base
        curr = prev * (1 + growth)
        return (max(0, curr), max(1, prev))

    # ratio / percentage — den always 100, num = target value
    nm = defn.get("norm_min")
    nx = defn.get("norm_max")
    nt = defn.get("norm_target")

    if anomaly is not None:
        target_ratio = anomaly
    elif nt is not None:
        nt_f = float(nt)
        if nt_f == 0:
            target_ratio = rnd(0, 0.02)
        elif nt_f == 1.0:
            target_ratio = rnd(0.92, 1.05) * base
        else:
            target_ratio = nt_f * rnd(0.90, 1.08) * base
    elif nm is not None and nx is not None:
        mn_f, mx_f = float(nm), float(nx)
        target_ratio = rnd(mn_f * 0.95, mx_f * 1.05) * base
    elif nm is not None:
        mn_f = float(nm)
        target_ratio = mn_f * rnd(0.9, 1.4) * base
    elif nx is not None:
        mx_f = float(nx)
        target_ratio = mx_f * rnd(0.3, 0.95) * base
    else:
        target_ratio = rnd(0.5, 1.2) * base

    if ft == "percentage":
        den = 100.0
        return (max(0, target_ratio), den)
    else:
        den = rnd(100, 1000)
        return (max(0, target_ratio * den), den)


async def main():
    async with engine_write.connect() as conn:
        # Fetch all definitions
        defs = (await conn.execute(text(
            "SELECT id, code, education_level, principle, number, "
            "formula_type, norm_min, norm_max, norm_target "
            "FROM coefficient_definitions WHERE is_active = TRUE ORDER BY id"
        ))).mappings().all()
        defs = [dict(d) for d in defs]
        print(f"  Загружено {len(defs)} определений коэффициентов")

        # Fetch all organizations with their type code
        orgs = (await conn.execute(text("""
            SELECT o.id, o.name_ru, ot.code AS type_code
            FROM organizations o
            JOIN org_types ot ON ot.id = o.org_type_id
            WHERE o.status = 'active'
            ORDER BY ot.code, o.name_ru
        """))).mappings().all()
        orgs = [dict(o) for o in orgs]
        print(f"  Загружено {len(orgs)} организаций")

        # Build anomaly set:  (org_idx_in_level, code, year) → forced_value
        # We'll identify anomaly orgs after we group them by level
        do_orgs    = [o for o in orgs if o["type_code"] == "ДО"]
        tippo_orgs = [o for o in orgs if o["type_code"] == "ТиППО"]
        vipo_orgs  = [o for o in orgs if o["type_code"] == "ВиПО"]

        # Anomaly org indices (0-based within each level)
        anomaly_map: dict[tuple, float] = {}
        # Кдо1 2020: первые 3 ДО
        do1_id = next((d["id"] for d in defs if d["code"] == "Кдо1"), None)
        for i, org in enumerate(do_orgs[:3]):
            if do1_id:
                anomaly_map[(str(org["id"]), do1_id, 2020)] = rnd(0.55, 0.68)

        # Кдо13 2022: первая ДО
        do13_id = next((d["id"] for d in defs if d["code"] == "Кдо13"), None)
        if do13_id and do_orgs:
            anomaly_map[(str(do_orgs[0]["id"]), do13_id, 2022)] = rnd(26, 32)  # percentage > 25%

        # Ктпп10 2023: первая ТиППО
        tppo10_id = next((d["id"] for d in defs if d["code"] == "Ктпп10"), None)
        if tppo10_id and tippo_orgs:
            anomaly_map[(str(tippo_orgs[0]["id"]), tppo10_id, 2023)] = rnd(0.38, 0.44)

        # Квпо19 2024: первый ВиПО
        vipo19_id = next((d["id"] for d in defs if d["code"] == "Квпо19"), None)
        if vipo19_id and vipo_orgs:
            anomaly_map[(str(vipo_orgs[0]["id"]), vipo19_id, 2024)] = rnd(0.50, 0.58)

        total_records = 0
        defs_by_level: dict[str, list] = {}
        for d in defs:
            defs_by_level.setdefault(d["education_level"], []).append(d)

        for org in orgs:
            type_code = org["type_code"]
            lvl = ORG_TYPE_LEVEL.get(type_code)
            if lvl is None:
                continue
            level_defs = defs_by_level.get(lvl, [])
            if not level_defs:
                continue

            org_id_str = str(org["id"])

            for year in range(2020, 2026):
                rows_to_insert = []
                for defn in level_defs:
                    anomaly_val = anomaly_map.get((org_id_str, defn["id"], year))

                    if anomaly_val is not None:
                        ft = defn["formula_type"]
                        if ft == "percentage":
                            num, den = anomaly_val, 100.0
                        elif ft == "ratio":
                            den = rnd(100, 1000)
                            num = anomaly_val * den
                        else:
                            num, den = gen_pair(defn, year, 0)
                    else:
                        num, den = gen_pair(defn, year, 0)

                    cv = calc(defn["formula_type"], num, den)
                    st = status(cv, defn["norm_min"], defn["norm_max"],
                                defn["norm_target"], defn["formula_type"])

                    rows_to_insert.append({
                        "org_id": org_id_str,
                        "coeff_def_id": defn["id"],
                        "period_year": year,
                        "num": round(num, 4),
                        "den": round(den, 4),
                        "cv": round(cv, 6),
                        "status": st,
                        "uid": SUPERADMIN_ID,
                    })

                # Bulk upsert for this org/year
                await conn.execute(text("""
                    INSERT INTO coefficient_records
                        (org_id, coeff_def_id, period_year, period_quarter,
                         numerator_value, denominator_value, coefficient_value,
                         status, submission_status, created_by, updated_by,
                         created_at, updated_at)
                    VALUES
                        (:org_id, :coeff_def_id, :period_year, NULL,
                         :num, :den, :cv,
                         :status, 'approved', :uid, :uid,
                         NOW(), NOW())
                    ON CONFLICT (org_id, coeff_def_id, period_year, period_quarter)
                    DO UPDATE SET
                        numerator_value   = EXCLUDED.numerator_value,
                        denominator_value = EXCLUDED.denominator_value,
                        coefficient_value = EXCLUDED.coefficient_value,
                        status            = EXCLUDED.status,
                        updated_at        = NOW(),
                        version           = coefficient_records.version + 1
                """), rows_to_insert)

                total_records += len(rows_to_insert)

        await conn.commit()
        print(f"  Вставлено/обновлено {total_records} записей коэффициентов")

        # ── Calculate scores for all orgs/years/levels ────────────────────
        score_rows = (await conn.execute(text("""
            SELECT DISTINCT r.org_id, d.education_level, r.period_year
            FROM coefficient_records r
            JOIN coefficient_definitions d ON d.id = r.coeff_def_id
            ORDER BY r.org_id, d.education_level, r.period_year
        """))).all()

        total_scores = 0
        for org_id_val, lvl, yr in score_rows:
            principle_rows = (await conn.execute(text("""
                SELECT d.principle, r.status
                FROM coefficient_records r
                JOIN coefficient_definitions d ON d.id = r.coeff_def_id
                WHERE r.org_id = :org_id AND r.period_year = :year
                  AND d.education_level = :lvl AND d.is_active = TRUE
            """), {"org_id": str(org_id_val), "year": yr, "lvl": lvl})).all()

            buckets: dict[str, list] = {p: [] for p in PRINCIPLE_WEIGHTS}
            for principle, st in principle_rows:
                if principle in buckets:
                    buckets[principle].append(STATUS_SCORE.get(st, 0))

            def avg(lst):
                return round(sum(lst) / len(lst), 2) if lst else None

            scores = {p: avg(v) for p, v in buckets.items()}
            filled = [(p, v) for p, v in scores.items() if v is not None]
            if filled:
                w_sum = sum(PRINCIPLE_WEIGHTS[p] for p, _ in filled)
                total = round(sum(PRINCIPLE_WEIGHTS[p] * v for p, v in filled) / w_sum, 2)
            else:
                total = None

            if total is None:
                cat = None
            elif total >= 85:
                cat = "A"
            elif total >= 70:
                cat = "B"
            elif total >= 50:
                cat = "C"
            else:
                cat = "D"

            await conn.execute(text("""
                INSERT INTO coefficient_scores
                    (org_id, education_level, period_year,
                     score_transparency, score_self_development,
                     score_financial_stability, score_safety,
                     score_investment_appeal, total_score, rating_category,
                     calculated_at)
                VALUES
                    (:org_id, :lvl, :year,
                     :tr, :sd, :fs, :sa, :ia, :total, :cat, NOW())
                ON CONFLICT (org_id, education_level, period_year)
                DO UPDATE SET
                    score_transparency        = EXCLUDED.score_transparency,
                    score_self_development    = EXCLUDED.score_self_development,
                    score_financial_stability = EXCLUDED.score_financial_stability,
                    score_safety              = EXCLUDED.score_safety,
                    score_investment_appeal   = EXCLUDED.score_investment_appeal,
                    total_score               = EXCLUDED.total_score,
                    rating_category           = EXCLUDED.rating_category,
                    calculated_at             = NOW()
            """), {
                "org_id": str(org_id_val), "lvl": lvl, "year": yr,
                "tr":  scores.get("transparency"),
                "sd":  scores.get("self_development"),
                "fs":  scores.get("financial_stability"),
                "sa":  scores.get("safety"),
                "ia":  scores.get("investment_appeal"),
                "total": total, "cat": cat,
            })
            total_scores += 1

        await conn.commit()
        print(f"  Рассчитано {total_scores} агрегированных баллов")

        # ── Verification query ─────────────────────────────────────────────
        result = (await conn.execute(text("""
            SELECT
                o.name_ru AS org,
                cs.education_level,
                cs.period_year,
                cs.total_score,
                cs.rating_category,
                cs.score_transparency,
                cs.score_financial_stability
            FROM coefficient_scores cs
            JOIN organizations o ON o.id = cs.org_id
            ORDER BY cs.period_year, cs.total_score DESC NULLS LAST
            LIMIT 30
        """))).all()

        print("\n  Топ-30 записей coefficient_scores:")
        print(f"  {'Организация':<40} {'Уровень':<6} {'Год'} {'Балл':>6} {'Кат'} {'Проз':>6} {'ФинУст':>7}")
        print("  " + "-" * 80)
        for r in result:
            name = (r[0] or "")[:38]
            print(f"  {name:<40} {r[1]:<6} {r[2]} {str(r[3] or '')!s:>6} {r[4] or '':>3} {str(r[5] or ''):>6} {str(r[6] or ''):>7}")


if __name__ == "__main__":
    print("=" * 60)
    print("Сид коэффициентов 2020–2025")
    print("=" * 60)
    asyncio.run(main())
    print("=" * 60)
    print("✅ Готово")
    print("=" * 60)
