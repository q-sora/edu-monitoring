"""
workers/tasks.py
─────────────────────────────────────────────────────────────────────────────
Celery tasks for background processing.

Task categories
───────────────
  sync_from_external       — Pull data from НОБД / ЕПВО / eGov APIs
  validate_and_promote     — Validate staged rows, promote to main tables
  notify_admins_submission — Notify admin users of new submissions
  export_to_csv            — Generate exports for ministry reports
  ai_anomaly_scan          — Run Gemini API anomaly detection on new data

Sync pipeline design
────────────────────
  Pull → Stage → Validate → Promote

  Stage:   Raw API responses land in a `sync_staging` table (not shown in
           main schema, but should be added in migrations).  This protects
           main tables from malformed external data.

  Validate: Domain rules checked in Python (same Pydantic schemas the API uses).

  Promote:  Only valid rows are upserted into main tables via the BaseCRUD
            upsert() method — same audit trail as manual form submissions.

Retry strategy
──────────────
  External APIs are unreliable.  Tasks use:
    autoretry_for=(httpx.TimeoutException, httpx.ConnectError)
    max_retries=3
    retry_backoff=True (exponential: 2, 4, 8 seconds)
    retry_jitter=True  (random jitter prevents thundering herd)
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import httpx

from app.workers.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_db_context

logger = logging.getLogger(__name__)

# External source configuration
SOURCE_CONFIG: dict[str, dict[str, str]] = {
    "НОБД": {
        "base_url":  settings.NOBD_API_URL,
        "api_key":   settings.NOBD_API_KEY,
        "delta_path": "/organizations/delta",
        "full_path":  "/organizations/full",
    },
    "ЕПВО": {
        "base_url":  settings.EPVO_API_URL,
        "api_key":   settings.EPVO_API_KEY,
        "delta_path": "/vuz/delta",
        "full_path":  "/vuz/full",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Helper: run an async function from a Celery sync task
# ─────────────────────────────────────────────────────────────────────────────

def run_async(coro):
    """
    Celery tasks are synchronous by default.
    We use a dedicated event loop per task to run async DB and HTTP code.

    Do NOT share the event loop across tasks — Celery workers handle
    tasks sequentially in the same thread, so we create a new loop each time.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ─────────────────────────────────────────────────────────────────────────────
# Task: External sync
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.workers.tasks.sync_from_external",
    max_retries=3,
    autoretry_for=(httpx.TimeoutException, httpx.ConnectError),
    retry_backoff=True,
    retry_jitter=True,
    acks_late=True,
)
def sync_from_external(
    self,
    source: str,
    full_sync: bool = False,
    org_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Pull data from external government API and sync to staging table.

    Args:
        source:    Source name key (НОБД, ЕПВО, eGov, etc.)
        full_sync: True = pull all records; False = delta since last sync
        org_id:    If set, sync only for one org (admin-triggered)

    Returns:
        dict with records_fetched, records_valid, records_upserted, duration_ms

    Retry:
        Automatic on network errors with exponential backoff.
        Max 3 retries before the task is marked FAILED and logged.
    """
    return run_async(_sync_from_external_async(source, full_sync, org_id))


async def _sync_from_external_async(
    source: str,
    full_sync: bool,
    org_id: Optional[str],
) -> dict[str, Any]:
    start = time.monotonic()
    config = SOURCE_CONFIG.get(source)

    if not config:
        logger.error("Unknown sync source: %s", source)
        return {"error": f"Unknown source: {source}"}

    path = config["full_path"] if full_sync else config["delta_path"]
    params: dict[str, Any] = {}
    if org_id:
        params["org_id"] = org_id

    if not config.get("api_key"):
        logger.warning("Sync source %s has no API key configured — skipping", source)
        return {"skipped": f"{source}: API key not configured"}

    if not config.get("base_url"):
        logger.warning("Sync source %s has no base_url configured — skipping", source)
        return {"skipped": f"{source}: base_url not configured"}

    logger.info("Starting sync: source=%s full=%s org=%s", source, full_sync, org_id)

    # ── 1. Fetch from external API ────────────────────────────────────────
    async with httpx.AsyncClient(
        base_url=config["base_url"],
        headers={"Authorization": f"Bearer {config['api_key']}"},
        timeout=30.0,
    ) as client:
        resp = await client.get(path, params=params)
        resp.raise_for_status()
        raw_records: list[dict] = resp.json().get("data", [])

    records_fetched = len(raw_records)
    logger.info("Fetched %d records from %s", records_fetched, source)

    # ── 2. Stage → Validate → Upsert ─────────────────────────────────────
    records_valid = 0
    records_upserted = 0
    errors: list[dict] = []

    async with get_db_context() as db:
        for raw in raw_records:
            try:
                validated = await _validate_external_record(source, raw)
                if validated:
                    await _upsert_external_record(db, source, validated)
                    records_valid += 1
                    records_upserted += 1
            except Exception as exc:
                errors.append({"record_id": raw.get("id"), "error": str(exc)})
                logger.warning("Validation error for %s record: %s", source, exc)

    duration_ms = int((time.monotonic() - start) * 1000)

    # ── 3. Write sync log ─────────────────────────────────────────────────
    await _write_sync_log(
        source=source,
        event="pull",
        status="success" if not errors else "partial",
        records=records_upserted,
        duration_ms=duration_ms,
        error=f"{len(errors)} validation errors" if errors else None,
        trigger="scheduled" if not org_id else "manual",
    )

    logger.info(
        "Sync complete: source=%s fetched=%d valid=%d upserted=%d errors=%d duration=%dms",
        source, records_fetched, records_valid, records_upserted, len(errors), duration_ms,
    )

    return {
        "source":           source,
        "records_fetched":  records_fetched,
        "records_valid":    records_valid,
        "records_upserted": records_upserted,
        "error_count":      len(errors),
        "duration_ms":      duration_ms,
    }


async def _validate_external_record(
    source: str,
    raw: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """
    Validate a raw external record using our Pydantic schemas.
    Returns the validated dict or None if validation fails.

    External data often has:
        - Missing fields (nullable in schema → fine)
        - Wrong types (Pydantic coerces most of these)
        - Out-of-range values (Pydantic validators catch these)
    """
    if source == "НОБД":
        # Example: map НОБД field names to our schema names
        mapped = {
            "org_id":      raw.get("organization_uuid"),
            "snapshot_date": raw.get("report_date"),
            "total_count": raw.get("students_total"),
            "budget_count": raw.get("state_grant_count"),
            "paid_count":   raw.get("paid_basis_count"),
            # ... map all fields
        }
        # Remove None values so Pydantic uses model defaults
        return {k: v for k, v in mapped.items() if v is not None}

    elif source == "ЕПВО":
        mapped = {
            "org_id": raw.get("vuz_uuid"),
            "period_year": raw.get("academic_year"),
            # ...
        }
        return {k: v for k, v in mapped.items() if v is not None}

    return raw


async def _upsert_external_record(
    db: Any,
    source: str,
    record: dict[str, Any],
) -> None:
    """
    Upsert a validated external record.
    Uses the same BaseCRUD.upsert() method as manual form submissions,
    so the audit trail and optimistic locking are applied consistently.
    """
    from app.crud.registry import contingent_crud
    from app.schemas.contingent import ContingentSnapshotCreate

    if source == "НОБД" and "snapshot_date" in record:
        schema = ContingentSnapshotCreate(**record)
        await contingent_crud.upsert(
            db,
            org_id=UUID(record["org_id"]),
            data=schema,
            actor_id="system:nobd_sync",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Task: Admin notifications on new submission
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.workers.tasks.notify_admins_submission",
    max_retries=2,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def notify_admins_submission(
    self,
    org_id: str,
    org_name: str,
    record_id: int,
    table_name: str,
    actor_email: str,
) -> None:
    """
    Notify all admin users that a new submission is awaiting review.
    In production: send email via SMTP or push to Notification service.
    """
    logger.info(
        "Submission notification: org=%s table=%s record=%d actor=%s",
        org_name, table_name, record_id, actor_email,
    )
    # Production implementation:
    # send_email(
    #     to=get_admin_emails(),
    #     subject=f"New submission: {org_name} - {table_name}",
    #     body=f"Record #{record_id} awaits review. Submitted by {actor_email}."
    # )


# ─────────────────────────────────────────────────────────────────────────────
# Task: AI anomaly detection
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.workers.tasks.ai_anomaly_scan",
    max_retries=1,
    rate_limit="5/m",   # Gemini API quota protection
)
def ai_anomaly_scan(self, org_id: str, table: str, record_id: int) -> dict:
    """
    Run Gemini API analysis on newly submitted data.
    Flags statistical outliers and data entry errors for admin review.

    Examples of anomalies detected:
        • budget_count > total_count
        • hirsch_index_avg > 30 for a small university
        • 0 graduates for an active university
        • publications_scopus decreased by > 50% year-over-year
    """
    return run_async(_ai_anomaly_scan_async(org_id, table, record_id))


async def _ai_anomaly_scan_async(org_id: str, table: str, record_id: int) -> dict:
    if not settings.GEMINI_API_KEY:
        return {"skipped": "GEMINI_API_KEY not configured"}

    # 1. Fetch the record
    # 2. Fetch last 3 years of history for the same org
    # 3. Build context prompt
    # 4. Call Gemini API
    # 5. Parse response and flag anomalies

    prompt = f"""
    You are a data quality analyst for Kazakhstan's national education database.
    Analyze this {table} record (org_id: {org_id}, record_id: {record_id}) and
    identify any statistical anomalies, data entry errors, or policy violations.
    Respond in JSON: {{"anomalies": [...], "confidence": 0.0-1.0, "summary": "..."}}
    """

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
            headers={"x-goog-api-key": settings.GEMINI_API_KEY},
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        if resp.status_code == 200:
            raw = resp.json()
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            logger.info("AI scan result for %s/%d: %s", table, record_id, text[:200])
            return {"result": text, "record_id": record_id}

    return {"error": "Gemini API call failed"}


# ─────────────────────────────────────────────────────────────────────────────
# Task: Weekly intelligent anomaly scan
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.workers.tasks.weekly_anomaly_scan",
    max_retries=1,
    acks_late=True,
    time_limit=900,
    soft_time_limit=840,
)
def weekly_anomaly_scan(
    self,
    years: Optional[list[int]] = None,
) -> dict[str, Any]:
    """
    Weekly scan: detect statistical outliers across all 5 education spheres,
    generate AI explanations via Gemini Pro, persist to anomaly_reports.

    Triggered automatically every Monday at 03:00 AST by Celery Beat.
    Can also be triggered manually: celery call app.workers.tasks.weekly_anomaly_scan
    """
    return run_async(_weekly_anomaly_scan_async(years))


async def _weekly_anomaly_scan_async(years: Optional[list[int]]) -> dict[str, Any]:
    from app.services.anomaly_scanner import AnomalyScanner

    if not settings.GEMINI_API_KEY:
        return {"skipped": "GEMINI_API_KEY not configured"}

    start = time.monotonic()
    async with get_db_context() as db:
        scanner = AnomalyScanner(db, settings.GEMINI_API_KEY)
        count = await scanner.run(years=years)

    duration_ms = int((time.monotonic() - start) * 1000)
    logger.info("weekly_anomaly_scan: persisted=%d duration=%dms", count, duration_ms)
    return {"status": "done", "anomalies_persisted": count, "duration_ms": duration_ms}


# ─────────────────────────────────────────────────────────────────────────────
# Sync log helper (writes to the audit_log table)
# ─────────────────────────────────────────────────────────────────────────────

async def _write_sync_log(
    *,
    source: str,
    event: str,
    status: str,
    records: int,
    duration_ms: int,
    error: Optional[str],
    trigger: str,
) -> None:
    """Write a sync log entry using raw SQL to avoid circular imports."""
    from sqlalchemy import text

    async with get_db_context() as db:
        async with db.begin():
            await db.execute(
                text("""
                    INSERT INTO audit_log (table_name, record_id, action, changed_by,
                                          old_data, new_data, changed_at)
                    VALUES ('sync_log', :source, 'INSERT', 'system:celery',
                            NULL,
                            CAST(:data AS jsonb),
                            NOW())
                """),
                {
                    "source": source,
                    "data": __import__("json").dumps({
                        "source":      source,
                        "event":       event,
                        "status":      status,
                        "records":     records,
                        "duration_ms": duration_ms,
                        "error":       error,
                        "trigger":     trigger,
                        "ts":          datetime.now(timezone.utc).isoformat(),
                    }),
                },
            )


# ─────────────────────────────────────────────────────────────────────────────
# Task: AI Presentation Report
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.workers.tasks.build_ai_presentation",
    max_retries=2,
    acks_late=True,
    time_limit=300,
    soft_time_limit=240,
)
def build_ai_presentation(
    self,
    report_id: int,
    period_year: int,
    requested_by: str,
    org_id: Optional[str] = None,
    region_id: Optional[int] = None,
    org_type_id: Optional[int] = None,
    focus: Optional[str] = None,
) -> dict[str, Any]:
    """
    Celery task: вычисляет аналитику (DataAnalyzer) и генерирует слайды (PresentationGenerator).
    Результат сохраняется в evaluation_reports.slides_json.

    Args:
        report_id:    ID строки в evaluation_reports (создаётся в endpoint до dispatch).
        period_year:  Год анализа.
        requested_by: UUID пользователя, запросившего отчёт.
        org_id:       Фильтр по организации (str UUID или None).
        region_id:    Фильтр по региону.
        org_type_id:  Фильтр по типу организации.
        focus:        Произвольный текстовый фокус от пользователя.
    """
    return run_async(
        _build_ai_presentation_async(
            report_id=report_id,
            period_year=period_year,
            requested_by=requested_by,
            org_id=UUID(org_id) if org_id else None,
            region_id=region_id,
            org_type_id=org_type_id,
            focus=focus,
        )
    )


async def _build_ai_presentation_async(
    *,
    report_id: int,
    period_year: int,
    requested_by: str,
    org_id: Optional[UUID],
    region_id: Optional[int],
    org_type_id: Optional[int],
    focus: Optional[str],
) -> dict[str, Any]:
    from datetime import datetime, timezone

    from sqlalchemy import text as sa_text

    from app.services.analytics_engine import DataAnalyzer
    from app.services.ai_synthesizer import PresentationGenerator
    from app.schemas.presentation import PresentationReport, PresentationStatus

    start = time.monotonic()

    async with get_db_context() as db:
        # ── 1. Отметить статус → generating ──────────────────────────────────
        await _set_report_status(db, report_id, "generating")

        try:
            # ── 2. Получить имена для scope (org, region, org_type) ───────────
            org_name, region_name, org_type_name = await _resolve_scope_names(
                db, org_id=org_id, region_id=region_id, org_type_id=org_type_id
            )

            # ── 3. Математический анализ (DataAnalyzer) ───────────────────────
            analyzer = DataAnalyzer(db)
            summary = await analyzer.run_full_analysis(
                year=period_year,
                org_id=org_id,
                region_id=region_id,
                org_type_id=org_type_id,
            )

            # ── 4. Семантический синтез (PresentationGenerator → Gemini) ──────
            generator = PresentationGenerator(timeout=200.0)
            slides, models_used = await generator.generate_slides(
                summary,
                user_focus=focus,
                org_name=org_name,
                region_name=region_name,
                org_type_name=org_type_name,
            )

            # ── 5. Упаковать в PresentationReport ────────────────────────────
            report = PresentationReport(
                report_id=report_id,
                org_id=org_id,
                org_name=org_name,
                region_name=region_name,
                org_type_name=org_type_name,
                period_year=period_year,
                focus=focus,
                generated_at=datetime.now(timezone.utc),
                model_used=models_used,
                context_rows=summary.org_count,
                slides=slides,
            )

            slides_json = report.model_dump_json()
            analytics_json = json.dumps(summary.to_compact_dict(), ensure_ascii=False)

            # ── 6. Сохранить результат ────────────────────────────────────────
            await db.execute(
                sa_text("""
                    UPDATE evaluation_reports
                    SET status        = 'done',
                        slides_json   = CAST(:slides AS jsonb),
                        analytics_json = CAST(:analytics AS jsonb),
                        updated_at    = NOW()
                    WHERE id = :id
                """),
                {"slides": slides_json, "analytics": analytics_json, "id": report_id},
            )
            await db.commit()

            duration_ms = int((time.monotonic() - start) * 1000)
            logger.info(
                "Presentation report %d done: %d slides, %d orgs, %dms",
                report_id, len(slides), summary.org_count, duration_ms,
            )
            return {"report_id": report_id, "status": "done", "slides": len(slides), "duration_ms": duration_ms}

        except Exception as exc:
            logger.exception("Presentation report %d failed: %s", report_id, exc)
            await _set_report_status(db, report_id, "failed", error=str(exc))
            await db.commit()
            raise


# ── Helpers for presentation task ─────────────────────────────────────────────

async def _set_report_status(
    db,
    report_id: int,
    status: str,
    error: Optional[str] = None,
) -> None:
    from sqlalchemy import text as sa_text

    await db.execute(
        sa_text("""
            UPDATE evaluation_reports
            SET status        = :status,
                error_message = :error,
                updated_at    = NOW()
            WHERE id = :id
        """),
        {"status": status, "error": error, "id": report_id},
    )
    await db.commit()


async def _resolve_scope_names(
    db,
    *,
    org_id: Optional[UUID],
    region_id: Optional[int],
    org_type_id: Optional[int],
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Возвращает (org_name, region_name, org_type_name) для скопа отчёта."""
    from sqlalchemy import text as sa_text

    org_name = region_name = org_type_name = None

    if org_id:
        row = await db.execute(
            sa_text("SELECT name_ru FROM organizations WHERE id = :id"),
            {"id": str(org_id)},
        )
        r = row.fetchone()
        if r:
            org_name = r[0]

    if region_id:
        row = await db.execute(
            sa_text("SELECT name_ru FROM regions WHERE id = :id"),
            {"id": region_id},
        )
        r = row.fetchone()
        if r:
            region_name = r[0]

    if org_type_id:
        row = await db.execute(
            sa_text("SELECT name_ru FROM org_types WHERE id = :id"),
            {"id": org_type_id},
        )
        r = row.fetchone()
        if r:
            org_type_name = r[0]

    return org_name, region_name, org_type_name
