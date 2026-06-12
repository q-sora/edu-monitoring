"""
services/ai_insights.py
─────────────────────────────────────────────────────────────────────────────
Gemini API integration for AI-powered analytics and anomaly detection.

Approach
────────
  1. Fetch relevant data from DB (scoped to the user's org or system-wide).
  2. Build a structured JSON context — not raw SQL dumps, but clean summaries.
  3. Send to Gemini with a system prompt that establishes the Kazakhstan
     education monitoring context.
  4. Parse the response and return structured insight objects.

Privacy
───────
  IINs (individual identification numbers) and personal student data are
  NEVER sent to the Gemini API.  Only aggregated counts and statistics
  are included in the prompt context.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.gemini_client import GeminiAPIError, gemini_post
from app.core.gemini_models import GeminiTask, get_url_for, get_generation_config

logger = logging.getLogger(__name__)


class _SafeEncoder(json.JSONEncoder):
    """Handles Decimal, UUID, date/datetime from SQLAlchemy row mappings."""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)


SYSTEM_CONTEXT = """
Ты — независимый эксперт-аналитик АО «Финансовый центр» (Казахстан) в сфере образования и государственных финансов.
Тебе предоставлены реальные данные из системы мониторинга АО «Финансовый центр». Твоя задача — строгий, честный анализ.

ТИПЫ ОРГАНИЗАЦИЙ в системе (поле org_type):
  ДО    — Дошкольное образование (детские сады)
  ДопО  — Дополнительное образование
  СО    — Среднее образование (школы)
  ТиППО — Техническое и профессиональное образование (колледжи)
  ВиПО  — Высшее и послевузовское образование (университеты)
  Общ-е — Общежития
  ГОНС  — ГОНС Келешек

СТРУКТУРА ДАННЫХ:
  - organizations: каталог (name_ru, org_type_code, org_type_name)
  - finance: годовой бюджет, госзаказ, расходы на ФОТ/НИОКР/стипендии/коммунальные/капитальные
  - contingent: контингент (бюджет/платные/иностранные/магистры/докторанты/дистанционные)
  - science: публикации Scopus/WoS, h-индекс, патенты, гранты, исследователи
  - graduates: трудоустройство через 6/12/36 мес, средняя зарплата, удовлетворённость работодателей
  - educational_process: преподаватели, программы, ГПА, аккредитации
  - coefficient_scores: рейтинг по 5 принципам (прозрачность, саморазвитие, финансовая устойчивость, безопасность, инвестиционная привлекательность)

СТРОГИЕ ПРАВИЛА (нарушение недопустимо):
1. ТОЛЬКО данные из контекста. Нельзя использовать внешние знания о конкретных организациях.
2. Каждое утверждение — цитата из данных: «[org_name]: значение X».
3. Если поле равно null или отсутствует — это само по себе аномалия, укажи это явно.
4. Не сглаживай негативные факты. Если данные плохие — так и пиши.
5. Не повторяй вопрос. Не начинай с похвалы или вводных слов.
6. Сравнивай организации между собой, вычисляй среднее по выборке, показывай отклонения.
7. Аномалия = статистическое отклонение ИЛИ логическое противоречие ИЛИ отсутствие обязательных данных.
8. Рекомендация = конкретное действие (не «улучшить», а «запросить у X пояснение по Y до Z»).
9. Ответ строго в JSON. Без markdown, без ```json, без пояснений вне JSON.

ФОРМАТ ОТВЕТА:
{
  "summary": "3-6 предложений. Конкретные цифры. Названия организаций. Сравнения. Главный вывод.",
  "anomalies": [
    {"field": "имя_поля", "value": "значение из данных", "issue": "что именно аномально и почему", "severity": "high|medium|low"}
  ],
  "recommendations": [
    "Конкретное действие: кто, что, когда"
  ]
}
"""


# ─────────────────────────────────────────────────────────────────────────────
# Insight request schema
# ─────────────────────────────────────────────────────────────────────────────

class InsightRequest:
    def __init__(
        self,
        query: str,
        org_id:        Optional[UUID] = None,
        region_id:     Optional[int]  = None,
        org_type_id:   Optional[int]  = None,
        year:          Optional[int]  = None,
        include_tables: Optional[list[str]] = None,
        row_limit:     int = 120,
    ):
        self.query = query
        self.org_id = org_id
        self.region_id = region_id
        self.org_type_id = org_type_id
        self.year = year
        self.include_tables = include_tables or [
            "science_activity", "contingent_snapshots", "finance_records"
        ]
        self.row_limit = row_limit


class InsightResponse:
    def __init__(
        self,
        summary: str,
        anomalies: list[dict[str, Any]],
        recommendations: list[str],
        raw_context_size: int,
        data: Optional[dict[str, Any]] = None,
        model_used: Optional[str] = None,
    ):
        self.summary = summary
        self.anomalies = anomalies
        self.recommendations = recommendations
        self.raw_context_size = raw_context_size
        self.data = data or {}
        self.model_used = model_used or "gemini-2.5-flash"

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary":         self.summary,
            "anomalies":       self.anomalies,
            "recommendations": self.recommendations,
            "context_rows":    self.raw_context_size,
            "model_used":      self.model_used,
            "data":            self.data,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Data context builder
# ─────────────────────────────────────────────────────────────────────────────

async def _build_context(
    db: AsyncSession,
    *,
    org_id:      Optional[UUID],
    region_id:   Optional[int] = None,
    org_type_id: Optional[int] = None,
    year:        Optional[int] = None,
    row_limit:   int = 120,
    tables: list[str],
) -> dict[str, Any]:
    """
    Build rich analytics context from all non-deleted records (all statuses).
    Covers all 7 org types: ДО, ДопО, СО, ТиППО, ВиПО, Общежития, ГОНС.
    Each record includes org_name + org_type so Gemini can group by sector.
    No PII — only aggregated counts and financial totals.
    """
    context: dict[str, Any] = {}
    params: dict[str, Any] = {"row_limit": row_limit}

    org_filter = ""
    if org_id:
        org_filter += " AND tbl.org_id = :org_id"
        params["org_id"] = str(org_id)
    if region_id:
        org_filter += " AND o.region_id = :region_id"
        params["region_id"] = region_id
    if org_type_id:
        org_filter += " AND o.org_type_id = :org_type_id"
        params["org_type_id"] = org_type_id

    # year filter for tables that have a year column
    year_filter_year  = ""
    year_filter_date  = ""
    if year:
        params["year"] = year
        year_filter_year = " AND tbl.period_year = :year"
        year_filter_date = " AND EXTRACT(year FROM tbl.snapshot_date) = :year"

    # ── Reference: org types legend (always included) ─────────────────────
    context["org_types_legend"] = {
        "ДО":     "Дошкольное образование (детские сады)",
        "ДопО":   "Дополнительное образование",
        "СО":     "Среднее образование (школы)",
        "ТиППО":  "Техническое и профессиональное образование (колледжи)",
        "ВиПО":   "Высшее и послевузовское образование (университеты)",
        "Общ-е":  "Общежития",
        "ГОНС":   "ГОНС Келешек",
    }
    context["filters_applied"] = {
        "year":        year,
        "region_id":   region_id,
        "org_type_id": org_type_id,
        "row_limit":   row_limit,
    }

    # ── Organisations catalogue (limited) ──────────────────────────────────
    o_extra = ""
    if org_id:
        o_extra += " AND o.id = :org_id"
    if region_id:
        o_extra += " AND o.region_id = :region_id"
    if org_type_id:
        o_extra += " AND o.org_type_id = :org_type_id"
    org_rows = (await db.execute(text(f"""
        SELECT o.id::text,
               o.name_ru,
               ot.code  AS org_type_code,
               ot.name_ru AS org_type_name,
               r.name_ru  AS region_name
        FROM   organizations o
        LEFT JOIN org_types ot ON ot.id = o.org_type_id
        LEFT JOIN regions   r  ON r.id  = o.region_id
        WHERE  o.status = 'active'
        {o_extra}
        ORDER BY ot.id, o.name_ru
        LIMIT :row_limit
    """), params)).mappings().all()
    context["organizations"] = [dict(r) for r in org_rows]
    if region_id:
        reg_row = (await db.execute(text(
            "SELECT name_ru FROM regions WHERE id = :rid"
        ), {"rid": region_id})).mappings().first()
        context["region_filter"] = reg_row["name_ru"] if reg_row else str(region_id)

    # ── Pre-computed anomaly summary (always included) ─────────────────────
    anom_params: dict[str, Any] = {}
    anom_org_filter = "1=1"
    if region_id:
        anom_org_filter += " AND o.region_id = :region_id"
        anom_params["region_id"] = region_id
    if org_type_id:
        anom_org_filter += " AND o.org_type_id = :org_type_id"
        anom_params["org_type_id"] = org_type_id
    if org_id:
        anom_org_filter += " AND o.id = :org_id"
        anom_params["org_id"] = str(org_id)

    anom_rows = (await db.execute(text(f"""
        WITH cont_lag AS (
          SELECT c.org_id, c.snapshot_date, c.total_count,
            LAG(c.total_count) OVER (PARTITION BY c.org_id ORDER BY c.snapshot_date) AS prev_count
          FROM contingent_snapshots c
          JOIN organizations o ON o.id = c.org_id
          WHERE c.deleted_at IS NULL AND {anom_org_filter}
        ),
        fin_data AS (
          SELECT f.org_id, f.period_year,
            f.annual_budget, f.expenses_payroll,
            CASE WHEN f.annual_budget > 0
              THEN ROUND(f.expenses_payroll / f.annual_budget * 100, 1)
              ELSE NULL END AS payroll_pct
          FROM finance_records f
          JOIN organizations o ON o.id = f.org_id
          WHERE f.deleted_at IS NULL AND {anom_org_filter}
        ),
        grad_data AS (
          SELECT g.org_id, COALESCE(g.graduation_year, g.period_year) AS yr,
            g.employed_6m_pct, g.total_graduates
          FROM graduates_records g
          JOIN organizations o ON o.id = g.org_id
          WHERE g.deleted_at IS NULL AND {anom_org_filter}
        )
        SELECT 'contingent_spike' AS anomaly_type,
          o.name_ru, r.name_ru AS region,
          cl.snapshot_date::text AS period,
          cl.total_count AS value_now,
          cl.prev_count AS value_prev,
          ROUND(cl.total_count::numeric / NULLIF(cl.prev_count, 0), 2) AS ratio
        FROM cont_lag cl
        JOIN organizations o ON o.id = cl.org_id
        LEFT JOIN regions r ON r.id = o.region_id
        WHERE cl.prev_count > 0
          AND (cl.total_count::float / cl.prev_count > 4
               OR cl.total_count::float / cl.prev_count < 0.25)
        UNION ALL
        SELECT 'payroll_exceeds_budget',
          o.name_ru, r.name_ru,
          fd.period_year::text,
          fd.expenses_payroll::bigint, fd.annual_budget::bigint,
          fd.payroll_pct
        FROM fin_data fd
        JOIN organizations o ON o.id = fd.org_id
        LEFT JOIN regions r ON r.id = o.region_id
        WHERE fd.payroll_pct > 100
        UNION ALL
        SELECT 'low_employment',
          o.name_ru, r.name_ru,
          gd.yr::text,
          gd.employed_6m_pct::bigint, gd.total_graduates, NULL
        FROM grad_data gd
        JOIN organizations o ON o.id = gd.org_id
        LEFT JOIN regions r ON r.id = o.region_id
        WHERE gd.employed_6m_pct < 20
        ORDER BY anomaly_type, ratio DESC NULLS LAST
        LIMIT 50
    """), anom_params)).mappings().all()
    context["detected_anomalies"] = [dict(r) for r in anom_rows]

    # helper: common JOIN fragment used in every data query
    def _org_join(alias: str) -> str:
        return f"""
            JOIN   organizations o  ON o.id  = {alias}.org_id
            JOIN   org_types     ot ON ot.id = o.org_type_id
        """

    # ── Finance records ────────────────────────────────────────────────────
    if "finance_records" in tables:
        rows = (await db.execute(text(f"""
            SELECT
                ot.code                                AS org_type,
                o.name_ru                              AS org_name,
                tbl.period_year                        AS year,
                tbl.submission_status                  AS status,
                tbl.annual_budget::text                AS annual_budget,
                tbl.state_order_volume::text           AS state_order,
                tbl.extra_budget_income::text          AS extra_budget_income,
                tbl.expenses_payroll::text             AS expenses_payroll,
                tbl.expenses_rnd::text                 AS expenses_rnd,
                tbl.expenses_scholarships::text        AS expenses_scholarships,
                tbl.expenses_utilities::text           AS expenses_utilities,
                tbl.vouchers_issued                    AS vouchers_issued,
                tbl.paid_vs_free_ratio::text           AS paid_vs_free_ratio,
                CASE WHEN tbl.annual_budget > 0
                     THEN ROUND(tbl.expenses_payroll / tbl.annual_budget * 100, 1)::text
                     ELSE NULL END                     AS payroll_pct_computed
            FROM   finance_records tbl
            {_org_join('tbl')}
            WHERE  tbl.deleted_at IS NULL
              AND  tbl.period_month IS NULL
              {org_filter}
              {year_filter_year}
            ORDER BY tbl.period_year DESC, tbl.annual_budget DESC NULLS LAST
            LIMIT :row_limit
        """), params)).mappings().all()
        context["finance"] = [dict(r) for r in rows]

    # ── Contingent snapshots ───────────────────────────────────────────────
    if "contingent_snapshots" in tables:
        rows = (await db.execute(text(f"""
            SELECT
                ot.code                                AS org_type,
                o.name_ru                              AS org_name,
                tbl.snapshot_date::text                AS date,
                tbl.submission_status                  AS status,
                tbl.total_count                        AS total,
                tbl.budget_count                       AS budget,
                tbl.paid_count                         AS paid,
                tbl.privileged_share::text             AS privileged_share_pct,
                tbl.new_enrolled                       AS new_enrolled,
                tbl.master_count                       AS masters,
                tbl.phd_count                          AS doctoral,
                tbl.distance_count                     AS distance_learning,
                tbl.kz_lang_count                      AS kz_language,
                tbl.disabled_count                     AS disabled,
                tbl.orphan_count                       AS orphan
            FROM   contingent_snapshots tbl
            {_org_join('tbl')}
            WHERE  tbl.deleted_at IS NULL
              {org_filter}
              {year_filter_date}
            ORDER BY tbl.snapshot_date DESC, tbl.total_count DESC NULLS LAST
            LIMIT :row_limit
        """), params)).mappings().all()
        context["contingent"] = [dict(r) for r in rows]

    # ── Science activity ───────────────────────────────────────────────────
    if "science_activity" in tables:
        rows = (await db.execute(text(f"""
            SELECT
                ot.code                                AS org_type,
                o.name_ru                              AS org_name,
                tbl.period_year                        AS year,
                tbl.submission_status                  AS status,
                tbl.hirsch_index_avg::text             AS hirsch_index_avg,
                tbl.publications_scopus                AS publications_scopus,
                tbl.publications_wos                   AS publications_wos,
                tbl.publications_total                 AS publications_total,
                tbl.patents_granted_kz                 AS patents_kz,
                tbl.grants_active_count                AS grants_active,
                tbl.grants_total_funding::text         AS grants_funding,
                tbl.niokr_total_count                  AS niokr_count,
                tbl.niokr_total_funding::text          AS niokr_funding,
                tbl.commercialized_results             AS commercialized
            FROM   science_activity tbl
            {_org_join('tbl')}
            WHERE  tbl.deleted_at IS NULL
              {org_filter}
              {year_filter_year}
            ORDER BY tbl.period_year DESC, tbl.publications_scopus DESC NULLS LAST
            LIMIT :row_limit
        """), params)).mappings().all()
        context["science"] = [dict(r) for r in rows]

    # ── Graduates ─────────────────────────────────────────────────────────
    if "graduates_records" in tables:
        rows = (await db.execute(text(f"""
            SELECT
                ot.code                                AS org_type,
                o.name_ru                              AS org_name,
                COALESCE(tbl.graduation_year, tbl.period_year) AS year,
                tbl.submission_status                  AS status,
                COALESCE(tbl.total_graduates, tbl.graduates_total) AS total_graduates,
                tbl.employed_6m_pct::text              AS employed_6m_pct,
                tbl.employed_12m_pct::text             AS employed_12m_pct,
                tbl.final_attestation_avg_score::text  AS attestation_avg_score,
                tbl.final_attestation_pass_pct::text   AS attestation_pass_pct,
                tbl.employed_by_specialty              AS employed_by_specialty,
                tbl.employed_count                     AS employed_count,
                tbl.graduates_with_honors              AS with_honors,
                tbl.graduates_grant_funded             AS grant_funded
            FROM   graduates_records tbl
            {_org_join('tbl')}
            WHERE  tbl.deleted_at IS NULL
              {org_filter}
            ORDER BY COALESCE(tbl.graduation_year, tbl.period_year) DESC,
                     tbl.employed_6m_pct ASC NULLS LAST
            LIMIT :row_limit
        """), params)).mappings().all()
        context["graduates"] = [dict(r) for r in rows]

    # ── Educational process ────────────────────────────────────────────────
    if "educational_process" in tables:
        rows = (await db.execute(text(f"""
            SELECT
                ot.code                                AS org_type,
                o.name_ru                              AS org_name,
                COALESCE(tbl.period_year, EXTRACT(YEAR FROM tbl.snapshot_date)::int) AS year,
                tbl.submission_status                  AS status,
                tbl.mandatory_programs_count           AS mandatory_programs,
                tbl.optional_programs_count            AS optional_programs,
                tbl.international_programs_count       AS international_programs,
                tbl.startup_projects_count             AS startup_projects,
                tbl.has_developing_environment         AS has_dev_environment,
                tbl.teachers_total                     AS teachers_total,
                tbl.teachers_with_phd                  AS teachers_with_phd,
                tbl.teachers_under_35                  AS teachers_young
            FROM   educational_process tbl
            {_org_join('tbl')}
            WHERE  tbl.deleted_at IS NULL
              {org_filter}
              {year_filter_date}
            ORDER BY COALESCE(tbl.period_year, EXTRACT(YEAR FROM tbl.snapshot_date)::int) DESC,
                     tbl.teachers_total DESC NULLS LAST
            LIMIT :row_limit
        """), params)).mappings().all()
        context["educational_process"] = [dict(r) for r in rows]

    # ── Coefficient scores (composite rating per org per year) ────────────
    if "coefficient_scores" in tables:
        rows = (await db.execute(text(f"""
            SELECT
                ot.code                                AS org_type,
                o.name_ru                              AS org_name,
                tbl.education_level,
                tbl.period_year                        AS year,
                tbl.score_transparency::text           AS score_transparency,
                tbl.score_self_development::text       AS score_self_development,
                tbl.score_financial_stability::text    AS score_financial_stability,
                tbl.score_safety::text                 AS score_safety,
                tbl.score_investment_appeal::text      AS score_investment_appeal,
                tbl.total_score::text                  AS total_score,
                tbl.rating_category
            FROM   coefficient_scores tbl
            {_org_join('tbl')}
            WHERE  TRUE
              {org_filter}
              {year_filter_year}
            ORDER BY tbl.period_year DESC, tbl.total_score DESC NULLS LAST
            LIMIT :row_limit
        """), params)).mappings().all()
        context["coefficient_scores"] = [dict(r) for r in rows]

    return context


# ─────────────────────────────────────────────────────────────────────────────
# Gemini API call
# ─────────────────────────────────────────────────────────────────────────────

_FULL_ANALYSIS_TABLE_THRESHOLD = 4   # таблиц — порог для Pro
_FULL_ANALYSIS_ROW_THRESHOLD   = 200 # строк — порог для Pro


def _select_insight_task(include_tables: list[str], row_limit: int) -> GeminiTask:
    """Flash для интерактивных запросов, Pro для полного скана (≥4 таблиц или ≥200 строк)."""
    if len(include_tables) >= _FULL_ANALYSIS_TABLE_THRESHOLD or row_limit >= _FULL_ANALYSIS_ROW_THRESHOLD:
        return GeminiTask.INSIGHT_FULL
    return GeminiTask.INSIGHT_QUICK


async def _call_gemini(prompt: str, task: GeminiTask = GeminiTask.INSIGHT_QUICK) -> str:
    """
    Вызывает Gemini с task-based routing.
    task=INSIGHT_QUICK  → gemini-2.5-flash (быстро, интерактивные запросы)
    task=INSIGHT_FULL   → gemini-2.5-pro   (глубокий комплексный анализ)

    Translates GeminiAPIError to FastAPI HTTPException so callers get clean HTTP responses.
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI insights are not configured (GEMINI_API_KEY missing).",
        )

    url = get_url_for(task)
    gen_cfg = get_generation_config(task, json_mode=True)
    model_id = url.split("/models/")[1].split(":")[0]
    logger.info("Gemini insights call: task=%s model=%s", task.value, model_id)

    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_CONTEXT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": gen_cfg,
    }

    try:
        return await gemini_post(url, settings.GEMINI_API_KEY, payload, timeout=120.0)
    except GeminiAPIError as exc:
        sc = exc.status_code
        if sc == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Лимит запросов к AI исчерпан. Подождите минуту и повторите.",
            ) from exc
        if sc == 503:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Модель временно перегружена. Повторите через 20–30 секунд.",
            ) from exc
        if "blockReason" in str(exc) or "No candidates" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Запрос заблокирован фильтрами безопасности модели. Перефразируйте вопрос.",
            ) from exc
        if "no parts" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Модель не вернула текст. Упростите запрос или смените тему.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI сервис недоступен (код {sc}). Попробуйте позже.",
        ) from exc


# ─────────────────────────────────────────────────────────────────────────────
# Public interface
# ─────────────────────────────────────────────────────────────────────────────

async def get_insights(
    db: AsyncSession,
    *,
    request: InsightRequest,
    force_refresh: bool = False,
) -> InsightResponse:
    """
    Main entry point for AI analytics queries.

    Flow:
        1. Build data context (aggregated, no PII).
        2. Construct a prompt combining the user's query + context.
        3. Call Gemini API.
        4. Parse structured JSON response.
        5. Return InsightResponse.

    Caching:
        Responses are cached in Redis for 5 minutes.
        Cache key = SHA-256(org_id + query + tables).
        This prevents duplicate Gemini calls for the same query.
    """
    from app.core.redis_client import get_cached, set_cached

    cache_key_parts = (
        str(request.org_id), str(request.region_id),
        str(request.org_type_id), str(request.year),
        request.query, ",".join(sorted(request.include_tables)),
    )
    if force_refresh:
        from app.core.redis_client import invalidate_prefix
        await invalidate_prefix("ai_insight", *cache_key_parts)
    cached = await get_cached("ai_insight", *cache_key_parts)
    if cached:
        return InsightResponse(
            summary=cached["summary"],
            anomalies=cached["anomalies"],
            recommendations=cached["recommendations"],
            raw_context_size=cached["context_rows"],
            data=cached.get("data", {}),
            model_used=cached.get("model_used"),
        )

    # Build context
    context = await _build_context(
        db,
        org_id=request.org_id,
        region_id=request.region_id,
        org_type_id=request.org_type_id,
        year=request.year,
        row_limit=request.row_limit,
        tables=request.include_tables,
    )
    context_size = sum(
        len(v) if isinstance(v, list) else 1
        for v in context.values()
    )

    # Compose prompt
    region_header = f"РЕГИОН ФИЛЬТРАЦИИ: {context.get('region_filter', 'все регионы')}\n" if request.region_id else ""
    prompt = f"""{region_header}ДАННЫЕ ИЗ БАЗЫ ДАННЫХ СИСТЕМЫ МОНИТОРИНГА (выгрузка на момент запроса):
{json.dumps(context, ensure_ascii=False, indent=2, cls=_SafeEncoder)}

---
ЗАДАНИЕ АНАЛИТИКА: {request.query}

ПОРЯДОК АНАЛИЗА (выполни все шаги):
1. Определи, какие организации и периоды есть в данных.
2. Вычисли средние значения по каждому числовому показателю.
3. Найди организации, отклоняющиеся от среднего более чем на 30%.
4. Найди null-значения в полях, которые должны быть заполнены.
5. Проверь логическую согласованность (например: расходы > бюджета, трудоустройство > 100%, и т.д.).
6. Сформулируй конкретные рекомендации для АО «Финансовый центр».

ТРЕБОВАНИЯ:
- Каждая аномалия должна содержать точное значение из данных.
- Не упоминай данные, которых нет в контексте.
- Поле status: approved = верифицированные данные; остальные — могут содержать ошибки.
"""

    selected_task = _select_insight_task(request.include_tables, request.row_limit)
    raw_text = await _call_gemini(prompt, task=selected_task)

    # Parse JSON response — Gemini 2.5 Pro often wraps in ```json ... ``` blocks.
    # Naive bracket-counting breaks when strings contain { or }, so we use a
    # proper state-machine parser that skips characters inside quoted strings.
    import re as _re

    def _extract_json(text: str) -> dict:
        # 1. Direct parse (works if Gemini returns clean JSON)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 2. Strip outermost code fence — take everything between ``` markers.
        #    Use a GREEDY inner group so we capture the full JSON, not just up to
        #    the first } in a string value (which breaks non-greedy .*?).
        fenced = _re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
        if fenced:
            candidate = fenced.group(1).strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                # Fall through to state-machine scan on the candidate
                text = candidate

        # 3. State-machine scan: find the outermost {...} while correctly
        #    skipping { and } that appear inside quoted string literals.
        i = 0
        n = len(text)
        while i < n:
            if text[i] == "{":
                start = i
                depth = 0
                in_str = False
                escape = False
                while i < n:
                    ch = text[i]
                    if escape:
                        escape = False
                    elif ch == "\\":
                        escape = True
                    elif ch == '"':
                        in_str = not in_str
                    elif not in_str:
                        if ch == "{":
                            depth += 1
                        elif ch == "}":
                            depth -= 1
                            if depth == 0:
                                candidate = text[start : i + 1]
                                try:
                                    return json.loads(candidate)
                                except json.JSONDecodeError:
                                    break  # this { … } wasn't valid — keep searching
                    i += 1
            i += 1
        raise json.JSONDecodeError("No valid JSON object found", text, 0)

    # Strip org_types_legend and organizations from chart data (not tabular)
    chart_data = {
        k: v for k, v in context.items()
        if isinstance(v, list) and k not in ("organizations",)
    }

    from app.core.gemini_models import model_display_name
    model_name = model_display_name(selected_task)

    try:
        parsed = _extract_json(raw_text)
        result = InsightResponse(
            summary=parsed.get("summary", ""),
            anomalies=parsed.get("anomalies", []),
            recommendations=parsed.get("recommendations", []),
            raw_context_size=context_size,
            data=chart_data,
            model_used=model_name,
        )
    except json.JSONDecodeError:
        logger.warning("Could not parse Gemini JSON response (len=%d)", len(raw_text))
        # Strip code fence before showing as fallback
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        result = InsightResponse(
            summary=cleaned[:3000],
            anomalies=[],
            recommendations=[],
            raw_context_size=context_size,
            data=chart_data,
            model_used=model_name,
        )

    # Cache for 24 hours — same query must return same answer
    await set_cached("ai_insight", result.to_dict(), *cache_key_parts, ttl=300)
    return result
