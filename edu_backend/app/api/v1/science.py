"""
api/v1/science.py
─────────────────────────────────────────────────────────────────────────────
FastAPI router: Science Activity data entry endpoints.

URL structure (nested under organisation):
    GET    /api/v1/organisations/{org_id}/science-activity
    POST   /api/v1/organisations/{org_id}/science-activity
    GET    /api/v1/organisations/{org_id}/science-activity/{id}
    PATCH  /api/v1/organisations/{org_id}/science-activity/{id}
    PATCH  /api/v1/organisations/{org_id}/science-activity/{id}/status
    DELETE /api/v1/organisations/{org_id}/science-activity/{id}

Why nested routes?
    Nesting under /organisations/{org_id} makes the org_id available as a
    path parameter that `require_own_org_or_admin` can read via Path().
    This is cleaner than encoding org_id in every request body.

Response headers:
    X-RateLimit-Remaining  — set by the rate-limit middleware
    X-Version              — used for cache-busting on the frontend
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    CanApprove,
    CanSubmit,
    DBSession,
    ReadDBSession,
    TokenPayload,
    UserRole,
    require_own_org_or_admin,
    verify_token,
)
from app.crud import science as science_crud
from app.schemas.science import (
    ScienceActivityCreate,
    ScienceActivityListResponse,
    ScienceActivityResponse,
    ScienceActivityUpdate,
    StatusChangeRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/organisations/{org_id}/science-activity",
    tags=["Научная деятельность"],
    # Apply org-isolation guard to every route in this router.
    # Individual routes can add further guards via their own Depends().
    dependencies=[Depends(require_own_org_or_admin)],
)


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=ScienceActivityListResponse,
    summary="Список записей научной деятельности",
    description="""
    Returns paginated science activity records for one organisation.

    **Caching**: results are cached in Redis for 5 minutes per (org_id + filter combo).
    Cache is invalidated automatically on any write operation.

    **RBAC**: data_entry sees only their own org; admin/superadmin can pass any org_id.
    """,
)
async def list_records(
    org_id: UUID,
    db: ReadDBSession,
    token: TokenPayload = Depends(verify_token),
    year_from: int | None = Query(None, ge=2010, le=2035, description="Filter: year ≥"),
    year_to:   int | None = Query(None, ge=2010, le=2035, description="Filter: year ≤"),
    submission_status: str | None = Query(
        None,
        pattern="^(draft|submitted|under_review|approved|rejected)$",
        description="Filter by workflow status",
    ),
    limit:  int = Query(20, ge=1, le=100),
    offset: int = Query(0,  ge=0),
) -> ScienceActivityListResponse:
    items, total = await science_crud.list_science_activity(
        db,
        org_id=org_id,
        year_from=year_from,
        year_to=year_to,
        submission_status=submission_status,
        limit=limit,
        offset=offset,
    )
    return ScienceActivityListResponse(
        items=[ScienceActivityResponse.model_validate(r) for r in items],
        total=total,
        limit=limit,
        offset=offset,
    )


# ─────────────────────────────────────────────────────────────────────────────
# CREATE / UPSERT
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=ScienceActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать / обновить запись научной деятельности",
    description="""
    **Upsert** — if a record for (org_id, period_year) already exists,
    it is updated in place using PostgreSQL `ON CONFLICT DO UPDATE`.
    Returns HTTP 201 if created, 200 if updated (check `X-Created` header).

    **JSONB fields**: `grants_json` and `student_projects_json` are arrays of
    typed objects.  Pass them as plain JSON arrays — do NOT pre-serialise to string.

    **Submission workflow**: set `submission_status: "submitted"` to send the
    record for admin review.  The backend validates the state transition.

    **Audit**: every write is recorded in `audit_log` with the actor's user_id.
    """,
)
async def create_or_upsert_record(
    org_id: UUID,
    body: ScienceActivityCreate,
    db: DBSession,
    token: CanSubmit,               # data_entry OR admin
    background_tasks: BackgroundTasks,
) -> JSONResponse:
    record, created = await science_crud.upsert_science_activity(
        db,
        org_id=org_id,
        data=body,
        actor_id=token.sub,
    )

    if body.submission_status == "submitted":
        # Non-blocking: notify admin queue via Celery / background task
        background_tasks.add_task(
            _notify_submission,
            org_id=str(org_id),
            record_id=record.id,
            actor=token.sub,
        )

    response_data = ScienceActivityResponse.model_validate(record).model_dump(mode="json")
    return JSONResponse(
        content=response_data,
        status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        headers={"X-Created": str(created)},
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET BY ID
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{record_id}",
    response_model=ScienceActivityResponse,
    summary="Получить запись по ID",
)
async def get_record(
    org_id: UUID,
    record_id: int,
    db: ReadDBSession,
    _token: TokenPayload = Depends(verify_token),
) -> ScienceActivityResponse:
    record = await science_crud.get_science_activity(
        db, record_id=record_id, org_id=org_id
    )
    return ScienceActivityResponse.model_validate(record)


# ─────────────────────────────────────────────────────────────────────────────
# PARTIAL UPDATE
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/{record_id}",
    response_model=ScienceActivityResponse,
    summary="Обновить черновик",
    description="""
    Partial update — only provided fields are modified.
    Only `draft` and `rejected` records can be edited by data_entry users.
    Admins can edit `submitted` / `under_review` records.

    **Optimistic locking**: include `version` from the last GET response.
    If the record was modified concurrently, returns HTTP 409 Conflict.
    """,
)
async def update_record(
    org_id: UUID,
    record_id: int,
    body: ScienceActivityUpdate,
    db: DBSession,
    token: CanSubmit,
) -> ScienceActivityResponse:
    is_admin = token.can("data.approve")
    record = await science_crud.update_science_activity(
        db,
        record_id=record_id,
        org_id=org_id,
        data=body,
        actor_id=token.sub,
        is_admin=is_admin,
    )
    return ScienceActivityResponse.model_validate(record)


# ─────────────────────────────────────────────────────────────────────────────
# STATUS CHANGE (admin only)
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/{record_id}/status",
    response_model=ScienceActivityResponse,
    summary="Изменить статус согласования (только Admin)",
    description="""
    Moves a record through the approval workflow.
    Valid transitions: `submitted → under_review | rejected`,
    `under_review → approved | rejected`, `rejected → draft`.
    `approved` is a terminal state — no further transitions.

    **Data integrity**: approved records become immutable (no updates or deletes).
    """,
)
async def change_status(
    org_id: UUID,
    record_id: int,
    body: StatusChangeRequest,
    db: DBSession,
    token: CanApprove,           # admin or superadmin
) -> ScienceActivityResponse:
    record = await science_crud.change_submission_status(
        db,
        record_id=record_id,
        org_id=org_id,
        data=body,
        actor_id=token.sub,
    )
    return ScienceActivityResponse.model_validate(record)


# ─────────────────────────────────────────────────────────────────────────────
# SOFT DELETE
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Логическое удаление записи",
    description="""
    Sets `deleted_at` — does NOT physically remove the row.
    Government data audit requirements prohibit physical deletion.
    Approved records cannot be deleted.
    """,
)
async def delete_record(
    org_id: UUID,
    record_id: int,
    db: DBSession,
    token: CanSubmit,
) -> Response:
    await science_crud.soft_delete_science_activity(
        db,
        record_id=record_id,
        org_id=org_id,
        actor_id=token.sub,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Background task helper
# ─────────────────────────────────────────────────────────────────────────────

async def _notify_submission(org_id: str, record_id: int, actor: str) -> None:
    """
    Non-blocking notification to admin users when a record is submitted.
    In production replace with a Celery task or Redis Pub/Sub message.
    """
    logger.info(
        "Submission notification: org=%s record=%d actor=%s",
        org_id, record_id, actor,
    )
    # In production:
    # from app.workers.tasks import notify_admins_task
    # notify_admins_task.delay(org_id=org_id, record_id=record_id, table="science_activity")
