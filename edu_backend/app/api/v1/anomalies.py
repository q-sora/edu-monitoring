"""
api/v1/anomalies.py
─────────────────────────────────────────────────────────────────────────────
AI Anomaly Detection — read-only API.

Endpoints:
    GET /admin/anomalies            — paginated list with filters
    GET /admin/anomalies/{id}       — single record detail
    PATCH /admin/anomalies/{id}     — update status (new → reviewed | dismissed)
    POST /admin/anomalies/trigger   — manually trigger scan (admin+)
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    AdminOrSuper,
    ReadDBSession,
    DBSession,
    TokenPayload,
    require_permission,
)
from app.models.anomalies import AnomalyReport

router = APIRouter(prefix="/admin/anomalies", tags=["AI Anomalies"])


# ─────────────────────────────────────────────────────────────────────────────
# Response schemas
# ─────────────────────────────────────────────────────────────────────────────

class AnomalyReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:             int
    sphere:         str
    region_id:      Optional[int]
    region_name:    Optional[str]   = None   # joined from regions
    year:           int
    severity:       str
    metric_name:    str
    metric_label:   Optional[str]
    raw_value:      Optional[float]
    expected_value: Optional[float]
    deviation_pct:  Optional[float]
    z_score:        Optional[float]
    trend_json:     Optional[Any]
    ai_explanation_json: Optional[Any]
    status:         str
    scan_run_at:    str
    created_at:     str


class AnomalyListResponse(BaseModel):
    items:   list[AnomalyReportOut]
    total:   int
    page:    int
    per_page: int


class AnomalyStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str   # reviewed | dismissed


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=AnomalyListResponse)
async def list_anomalies(
    db:        ReadDBSession,
    token:     TokenPayload = Depends(require_permission("ai_insights.view")),
    sphere:    Optional[str] = Query(None),
    year:      Optional[int] = Query(None),
    region_id: Optional[int] = Query(None),
    severity:  Optional[str] = Query(None),
    status_f:  Optional[str] = Query(None, alias="status"),
    page:      int = Query(1, ge=1),
    per_page:  int = Query(20, ge=1, le=100),
) -> AnomalyListResponse:
    """
    List anomaly reports with optional filters.
    Results include region_name from the regions table.
    """
    filters: list[str] = ["1=1"]
    params:  dict      = {}

    if sphere:
        filters.append("ar.sphere = :sphere")
        params["sphere"] = sphere
    if year:
        filters.append("ar.year = :year")
        params["year"] = year
    if region_id:
        filters.append("ar.region_id = :region_id")
        params["region_id"] = region_id
    if severity:
        filters.append("ar.severity = :severity")
        params["severity"] = severity
    if status_f:
        filters.append("ar.status = :status_f")
        params["status_f"] = status_f

    where = " AND ".join(filters)

    # Count
    count_sql = text(f"SELECT COUNT(*) FROM anomaly_reports ar WHERE {where}")
    total = (await db.execute(count_sql, params)).scalar() or 0

    # Data
    offset = (page - 1) * per_page
    data_sql = text(f"""
        SELECT
            ar.id, ar.sphere, ar.region_id, r.name_ru AS region_name,
            ar.year, ar.severity, ar.metric_name, ar.metric_label,
            ar.raw_value::float, ar.expected_value::float,
            ar.deviation_pct::float, ar.z_score::float,
            ar.trend_json, ar.ai_explanation_json,
            ar.status,
            ar.scan_run_at::text, ar.created_at::text
        FROM anomaly_reports ar
        LEFT JOIN regions r ON r.id = ar.region_id
        WHERE {where}
        ORDER BY
            CASE ar.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
            ABS(ar.deviation_pct) DESC NULLS LAST,
            ar.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    params["limit"]  = per_page
    params["offset"] = offset

    rows = (await db.execute(data_sql, params)).fetchall()

    items = [
        AnomalyReportOut(
            id=r[0], sphere=r[1], region_id=r[2], region_name=r[3],
            year=r[4], severity=r[5], metric_name=r[6], metric_label=r[7],
            raw_value=r[8], expected_value=r[9], deviation_pct=r[10], z_score=r[11],
            trend_json=r[12], ai_explanation_json=r[13],
            status=r[14], scan_run_at=r[15], created_at=r[16],
        )
        for r in rows
    ]

    return AnomalyListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{anomaly_id}", response_model=AnomalyReportOut)
async def get_anomaly(
    anomaly_id: int,
    db:         ReadDBSession,
    token:      TokenPayload = Depends(require_permission("ai_insights.view")),
) -> AnomalyReportOut:
    sql = text("""
        SELECT
            ar.id, ar.sphere, ar.region_id, r.name_ru AS region_name,
            ar.year, ar.severity, ar.metric_name, ar.metric_label,
            ar.raw_value::float, ar.expected_value::float,
            ar.deviation_pct::float, ar.z_score::float,
            ar.trend_json, ar.ai_explanation_json,
            ar.status, ar.scan_run_at::text, ar.created_at::text
        FROM anomaly_reports ar
        LEFT JOIN regions r ON r.id = ar.region_id
        WHERE ar.id = :id
    """)
    row = (await db.execute(sql, {"id": anomaly_id})).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Anomaly report not found")

    return AnomalyReportOut(
        id=row[0], sphere=row[1], region_id=row[2], region_name=row[3],
        year=row[4], severity=row[5], metric_name=row[6], metric_label=row[7],
        raw_value=row[8], expected_value=row[9], deviation_pct=row[10], z_score=row[11],
        trend_json=row[12], ai_explanation_json=row[13],
        status=row[14], scan_run_at=row[15], created_at=row[16],
    )


@router.patch("/{anomaly_id}", response_model=AnomalyReportOut)
async def update_anomaly_status(
    anomaly_id: int,
    body:       AnomalyStatusUpdate,
    db:         DBSession,
    token:      TokenPayload = Depends(require_permission("ai_insights.view")),
) -> AnomalyReportOut:
    if body.status not in ("reviewed", "dismissed", "new"):
        raise HTTPException(status_code=422, detail="status must be: new | reviewed | dismissed")

    await db.execute(
        text("UPDATE anomaly_reports SET status = :s WHERE id = :id"),
        {"s": body.status, "id": anomaly_id},
    )
    await db.commit()
    return await get_anomaly(anomaly_id, db, token)  # type: ignore[arg-type]


@router.post("/trigger", status_code=202)
async def trigger_anomaly_scan(
    token:      TokenPayload = Depends(AdminOrSuper),
    years:      Optional[list[int]] = None,
) -> dict:
    """
    Manually trigger the weekly anomaly scan (admin+).
    Returns immediately — the scan runs as a Celery background task.
    """
    from app.workers.tasks import weekly_anomaly_scan
    task = weekly_anomaly_scan.apply_async(kwargs={"years": years})
    return {"task_id": task.id, "status": "queued"}


@router.get("/meta/summary")
async def anomaly_summary(
    db:    ReadDBSession,
    token: TokenPayload = Depends(require_permission("ai_insights.view")),
) -> dict:
    """Summary stats for the dashboard badge."""
    sql = text("""
        SELECT severity, COUNT(*) FROM anomaly_reports
        WHERE status = 'new'
        GROUP BY severity
    """)
    rows = (await db.execute(sql)).fetchall()
    result = {"critical": 0, "warning": 0, "info": 0, "total": 0}
    for sev, cnt in rows:
        if sev in result:
            result[sev] = cnt
    result["total"] = result["critical"] + result["warning"] + result["info"]
    return result
