"""
api/v1/router_factory.py
─────────────────────────────────────────────────────────────────────────────
Generates a complete 6-endpoint CRUD router for any domain table.

Why a factory?
    Every data-entry domain (contingent, finance, graduates, education) needs
    the same six endpoints:
        GET    /organisations/{org_id}/<resource>
        POST   /organisations/{org_id}/<resource>
        GET    /organisations/{org_id}/<resource>/{id}
        PATCH  /organisations/{org_id}/<resource>/{id}
        PATCH  /organisations/{org_id}/<resource>/{id}/status
        DELETE /organisations/{org_id}/<resource>/{id}

    Rather than copying 100 lines per domain (error-prone, hard to maintain),
    the factory accepts the CRUD instance + schema types and wires them up
    in one call.  Domain-specific validation lives in the Pydantic schemas
    and BaseCRUD subclasses — not here.

Usage
─────
    from app.api.v1.router_factory import build_domain_router
    from app.crud.registry import contingent_crud
    from app.schemas.contingent import (
        ContingentSnapshotCreate, ContingentSnapshotUpdate,
        ContingentSnapshotResponse, ContingentListResponse,
    )

    contingent_router = build_domain_router(
        resource_path="contingent",
        tag="Контингент студентов",
        crud=contingent_crud,
        create_schema=ContingentSnapshotCreate,
        update_schema=ContingentSnapshotUpdate,
        response_schema=ContingentSnapshotResponse,
        list_response_schema=ContingentListResponse,
    )
"""

import logging
from typing import Any, Type
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    CanApprove,
    CanSubmit,
    DBSession,
    ReadDBSession,
    TokenPayload,
    require_own_org_or_admin,
    verify_token,
)
from app.crud.base import BaseCRUD
from app.schemas.science import StatusChangeRequest   # shared schema

logger = logging.getLogger(__name__)


def build_domain_router(
    *,
    resource_path: str,           # e.g. "contingent", "finance"
    tag: str,                     # OpenAPI tag (Russian label)
    crud: BaseCRUD,               # e.g. contingent_crud
    create_schema: Type,          # Pydantic create model
    update_schema: Type,          # Pydantic update model
    response_schema: Type,        # Pydantic response model
    list_response_schema: Type,   # Pydantic list-wrapper model
    extra_list_filter_fn: Any = None,  # optional: (org_id, query_params) → list[filter]
) -> APIRouter:
    """
    Returns a fully wired APIRouter.  Attach to the app with:
        app.include_router(router, prefix="/api/v1")
    """

    router = APIRouter(
        prefix=f"/organisations/{{org_id}}/{resource_path}",
        tags=[tag],
        dependencies=[Depends(require_own_org_or_admin)],
    )

    # ── LIST ──────────────────────────────────────────────────────────────

    @router.get("", response_model=list_response_schema, summary=f"Список: {tag}")
    async def list_records(
        org_id: UUID,
        db: ReadDBSession,
        _token: TokenPayload = Depends(verify_token),
        submission_status: str | None = Query(
            None, pattern="^(draft|submitted|under_review|approved|rejected)$"
        ),
        limit:  int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0),
    ) -> list_response_schema:
        items, total = await crud.list(
            db,
            org_id=org_id,
            submission_status=submission_status,
            limit=limit,
            offset=offset,
        )
        return list_response_schema(
            items=[response_schema.model_validate(r) for r in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    # ── CREATE / UPSERT ───────────────────────────────────────────────────

    @router.post(
        "",
        response_model=response_schema,
        status_code=status.HTTP_201_CREATED,
        summary=f"Создать / обновить: {tag}",
    )
    async def create_record(
        org_id: UUID,
        body: create_schema,
        db: DBSession,
        token: CanSubmit,
        background_tasks: BackgroundTasks,
    ) -> JSONResponse:
        record, created = await crud.upsert(
            db, org_id=org_id, data=body, actor_id=token.sub
        )
        if getattr(body, "submission_status", None) == "submitted":
            background_tasks.add_task(
                _log_submission,
                resource=resource_path,
                org_id=str(org_id),
                record_id=record.id,
                actor=token.sub,
            )
        return JSONResponse(
            content=response_schema.model_validate(record).model_dump(mode="json"),
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            headers={"X-Created": str(created)},
        )

    # ── GET BY ID ─────────────────────────────────────────────────────────

    @router.get("/{record_id}", response_model=response_schema, summary=f"Получить: {tag}")
    async def get_record(
        org_id: UUID,
        record_id: int,
        db: ReadDBSession,
        _token: TokenPayload = Depends(verify_token),
    ) -> response_schema:
        record = await crud.get(db, record_id=record_id, org_id=org_id)
        return response_schema.model_validate(record)

    # ── PATCH ─────────────────────────────────────────────────────────────

    @router.patch(
        "/{record_id}",
        response_model=response_schema,
        summary=f"Обновить черновик: {tag}",
    )
    async def update_record(
        org_id: UUID,
        record_id: int,
        body: update_schema,
        db: DBSession,
        token: CanSubmit,
    ) -> response_schema:
        record = await crud.update(
            db,
            record_id=record_id,
            org_id=org_id,
            data=body,
            actor_id=token.sub,
            is_admin=token.can("data.approve"),
        )
        return response_schema.model_validate(record)

    # ── STATUS CHANGE ─────────────────────────────────────────────────────

    @router.patch(
        "/{record_id}/status",
        response_model=response_schema,
        summary=f"Изменить статус: {tag} (Admin)",
    )
    async def change_status(
        org_id: UUID,
        record_id: int,
        body: StatusChangeRequest,
        db: DBSession,
        token: CanApprove,
    ) -> response_schema:
        record = await crud.change_status(
            db,
            record_id=record_id,
            org_id=org_id,
            data=body,
            actor_id=token.sub,
        )
        return response_schema.model_validate(record)

    # ── SOFT DELETE ───────────────────────────────────────────────────────

    @router.delete(
        "/{record_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary=f"Удалить (мягко): {tag}",
    )
    async def delete_record(
        org_id: UUID,
        record_id: int,
        db: DBSession,
        token: CanSubmit,
    ) -> Response:
        await crud.soft_delete(
            db, record_id=record_id, org_id=org_id, actor_id=token.sub
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router


async def _log_submission(resource: str, org_id: str, record_id: int, actor: str) -> None:
    """Background: log submission event for monitoring / admin notifications."""
    logger.info(
        "SUBMISSION | resource=%s org=%s record_id=%d actor=%s",
        resource, org_id, record_id, actor,
    )
