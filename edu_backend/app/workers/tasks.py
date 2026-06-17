"""
workers/tasks.py
─────────────────────────────────────────────────────────────────────────────
Celery tasks for background processing.

Active tasks:
  sync_from_external — Pull data from НОБД / ЕПВО APIs into domain tables.
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

SOURCE_CONFIG: dict[str, dict[str, str]] = {
    "НОБД": {
        "base_url":   settings.NOBD_API_URL,
        "api_key":    settings.NOBD_API_KEY,
        "delta_path": "/organizations/delta",
        "full_path":  "/organizations/full",
    },
    "ЕПВО": {
        "base_url":   settings.EPVO_API_URL,
        "api_key":    settings.EPVO_API_KEY,
        "delta_path": "/vuz/delta",
        "full_path":  "/vuz/full",
    },
}


def run_async(coro):
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
        logger.warning("Sync source %s has no API key — skipping", source)
        return {"skipped": f"{source}: API key not configured"}

    if not config.get("base_url"):
        logger.warning("Sync source %s has no base_url — skipping", source)
        return {"skipped": f"{source}: base_url not configured"}

    logger.info("Starting sync: source=%s full=%s org=%s", source, full_sync, org_id)

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
    if source == "НОБД":
        mapped = {
            "org_id":        raw.get("organization_uuid"),
            "snapshot_date": raw.get("report_date"),
            "total_count":   raw.get("students_total"),
            "budget_count":  raw.get("state_grant_count"),
            "paid_count":    raw.get("paid_basis_count"),
        }
        return {k: v for k, v in mapped.items() if v is not None}
    elif source == "ЕПВО":
        mapped = {
            "org_id":      raw.get("vuz_uuid"),
            "period_year": raw.get("academic_year"),
        }
        return {k: v for k, v in mapped.items() if v is not None}
    return raw


async def _upsert_external_record(
    db: Any,
    source: str,
    record: dict[str, Any],
) -> None:
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
    from sqlalchemy import text

    async with get_db_context() as db:
        async with db.begin():
            await db.execute(
                text("""
                    INSERT INTO audit_log (table_name, record_id, action, changed_by,
                                          old_data, new_data, changed_at)
                    VALUES ('sync_log', :source, 'INSERT', 'system:celery',
                            NULL, CAST(:data AS jsonb), NOW())
                """),
                {
                    "source": source,
                    "data": json.dumps({
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
