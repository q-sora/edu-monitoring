"""
services/submission.py
─────────────────────────────────────────────────────────────────────────────
Submission workflow service — business logic that spans multiple tables.

Responsibilities
────────────────
  • Aggregate pending submissions across all domain tables into one view.
  • Dispatch AI anomaly scan task after every new submission.
  • Compute submission completeness score for an organisation.
  • Generate submission deadlines and reminder schedule.

Why a service layer?
    The CRUD layer handles one table at a time.  Business rules that span
    multiple tables (e.g., "show all pending records from any table for this
    org") belong in a service, not in a router or CRUD function.

    The service layer is also the correct place for:
        • Sending Celery tasks after writes
        • Calling external APIs (Gemini)
        • Cross-table aggregations that the DB cannot do in one query
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contingent import ContingentSnapshot
from app.models.education import EducationalProcess
from app.models.finance import FinanceRecord
from app.models.graduates import GraduatesRecord
from app.models.science import ScienceActivity
from app.models.organization import Organization
from app.schemas.organization import PendingSubmission

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Domain table registry used for cross-table queries
# ─────────────────────────────────────────────────────────────────────────────

_DOMAIN_TABLES: list[dict[str, Any]] = [
    {
        "model":       ScienceActivity,
        "label":       "Научная деятельность",
        "period_col":  "period_year",
        "period_type": "year",
    },
    {
        "model":       ContingentSnapshot,
        "label":       "Контингент студентов",
        "period_col":  "snapshot_date",
        "period_type": "date",
    },
    {
        "model":       FinanceRecord,
        "label":       "Финансы и бюджет",
        "period_col":  "period_year",
        "period_type": "year_month",
    },
    {
        "model":       GraduatesRecord,
        "label":       "Выпускники",
        "period_col":  "graduation_year",
        "period_type": "year",
    },
    {
        "model":       EducationalProcess,
        "label":       "Образовательный процесс",
        "period_col":  "snapshot_date",
        "period_type": "date",
    },
]

_MONTHS_RU = [
    "", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]


def _fmt_period(record: Any, period_type: str) -> str:
    """Format a period column value into a human-readable Russian string."""
    if period_type == "year":
        return str(getattr(record, list(_get_period_col(period_type, record))[0], ""))
    elif period_type == "year_month":
        yr  = getattr(record, "period_year", "")
        mo  = getattr(record, "period_month", None)
        return f"{_MONTHS_RU[mo]} {yr}" if mo else str(yr)
    elif period_type == "date":
        d = getattr(record, "snapshot_date", None) or getattr(record, "graduation_year", "")
        if isinstance(d, date):
            return f"{_MONTHS_RU[d.month]} {d.year}"
        return str(d)
    return ""


def _get_period_col(period_type: str, record: Any) -> set[str]:
    return {"period_year", "snapshot_date", "graduation_year"}


# ─────────────────────────────────────────────────────────────────────────────
# Aggregate pending submissions
# ─────────────────────────────────────────────────────────────────────────────

async def get_pending_submissions(
    db: AsyncSession,
    *,
    org_id:        Optional[UUID] = None,
    status_filter: Optional[str] = "submitted",
    domain_filter: Optional[str] = None,
    year_filter:   Optional[int] = None,
    region_id:     Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[PendingSubmission], int]:
    """
    Aggregates pending / submitted / under_review records from ALL domain tables.
    Supports filtering by domain (table label), year, and region.
    """
    results: list[PendingSubmission] = []

    for domain in _DOMAIN_TABLES:
        model = domain["model"]
        label = domain["label"]

        # Skip domains not matching the filter
        if domain_filter and domain["model"].__tablename__ != domain_filter:
            continue

        stmt = (
            select(model, Organization.name_ru.label("org_name"), Organization.region_id.label("org_region_id"))
            .join(Organization, Organization.id == model.org_id)
            .where(
                model.deleted_at.is_(None),
                model.submission_status == (status_filter or "submitted"),
            )
        )
        if org_id:
            stmt = stmt.where(model.org_id == org_id)
        if region_id:
            stmt = stmt.where(Organization.region_id == region_id)
        if year_filter:
            period_col = domain["period_col"]
            col = getattr(model, period_col, None)
            if col is not None:
                if domain["period_type"] == "date":
                    stmt = stmt.where(func.extract("year", col) == year_filter)
                else:
                    stmt = stmt.where(col == year_filter)

        rows = (await db.execute(stmt)).all()

        for row in rows:
            record = row[0]
            org_name = row[1]

            results.append(
                PendingSubmission(
                    record_id=record.id,
                    table_name=model.__tablename__,
                    table_label=label,
                    org_id=record.org_id,
                    org_name=org_name or "—",
                    period=_fmt_period(record, domain["period_type"]),
                    status=record.submission_status,
                    submitted_at=record.updated_at,
                    submitted_by=record.updated_by,
                )
            )

    # Sort by submitted_at descending (most recent first)
    results.sort(
        key=lambda r: r.submitted_at or date.min,
        reverse=True,
    )

    total = len(results)
    paginated = results[offset : offset + limit]
    return paginated, total


# ─────────────────────────────────────────────────────────────────────────────
# Submission completeness score
# ─────────────────────────────────────────────────────────────────────────────

async def get_completeness_score(
    db: AsyncSession,
    *,
    org_id: UUID,
    year: int,
) -> dict[str, Any]:
    """
    Returns a completeness score (0-100%) for an organisation's annual submissions.

    Checks:
        • Has at least one approved contingent snapshot for the year
        • Has an approved science_activity for the year
        • Has at least one approved finance_record for the year
        • Has an approved graduates_record for the year
        • Has at least one approved educational_process snapshot for the year

    Used by the org dashboard to show progress toward full submission.
    """
    checks: dict[str, bool] = {}

    # Contingent: any snapshot in the given year
    cont = await db.scalar(
        select(func.count())
        .select_from(ContingentSnapshot)
        .where(
            ContingentSnapshot.org_id == org_id,
            ContingentSnapshot.submission_status == "approved",
            func.extract("year", ContingentSnapshot.snapshot_date) == year,
            ContingentSnapshot.deleted_at.is_(None),
        )
    )
    checks["contingent"] = (cont or 0) > 0

    # Science activity
    sci = await db.scalar(
        select(func.count())
        .select_from(ScienceActivity)
        .where(
            ScienceActivity.org_id == org_id,
            ScienceActivity.period_year == year,
            ScienceActivity.submission_status == "approved",
            ScienceActivity.deleted_at.is_(None),
        )
    )
    checks["science"] = (sci or 0) > 0

    # Finance
    fin = await db.scalar(
        select(func.count())
        .select_from(FinanceRecord)
        .where(
            FinanceRecord.org_id == org_id,
            FinanceRecord.period_year == year,
            FinanceRecord.submission_status == "approved",
            FinanceRecord.deleted_at.is_(None),
        )
    )
    checks["finance"] = (fin or 0) > 0

    # Graduates (for the prior year — you submit this year's graduates in current year)
    grad = await db.scalar(
        select(func.count())
        .select_from(GraduatesRecord)
        .where(
            GraduatesRecord.org_id == org_id,
            GraduatesRecord.graduation_year == year - 1,
            GraduatesRecord.submission_status == "approved",
            GraduatesRecord.deleted_at.is_(None),
        )
    )
    checks["graduates"] = (grad or 0) > 0

    # Education process
    edu = await db.scalar(
        select(func.count())
        .select_from(EducationalProcess)
        .where(
            EducationalProcess.org_id == org_id,
            func.extract("year", EducationalProcess.snapshot_date) == year,
            EducationalProcess.submission_status == "approved",
            EducationalProcess.deleted_at.is_(None),
        )
    )
    checks["education"] = (edu or 0) > 0

    completed = sum(1 for v in checks.values() if v)
    score_pct = round((completed / len(checks)) * 100)

    return {
        "org_id":     str(org_id),
        "year":       year,
        "checks":     checks,
        "completed":  completed,
        "total":      len(checks),
        "score_pct":  score_pct,
        "is_complete": score_pct == 100,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Trigger post-submission side effects
# ─────────────────────────────────────────────────────────────────────────────

def trigger_submission_effects(
    *,
    org_id: str,
    org_name: str,
    record_id: int,
    table_name: str,
    actor_email: str,
) -> None:
    """
    Fire-and-forget side effects after a successful submission.
    Called from the router layer (non-blocking).

    Side effects:
        1. Notify admin users (Celery task)
        2. Schedule AI anomaly scan (Celery task, delayed 30s to let DB commit)
    """
    try:
        from app.workers.tasks import ai_anomaly_scan, notify_admins_submission

        notify_admins_submission.apply_async(
            kwargs={
                "org_id":      org_id,
                "org_name":    org_name,
                "record_id":   record_id,
                "table_name":  table_name,
                "actor_email": actor_email,
            },
            countdown=2,
        )
        ai_anomaly_scan.apply_async(
            args=[org_id, table_name, record_id],
            countdown=30,    # give DB 30s to fully commit before AI reads it
        )
    except Exception as exc:
        # Side effects must never fail the main request
        logger.warning(
            "Could not dispatch submission side effects for record %d: %s",
            record_id, exc,
        )
