"""
api/v1/admin.py
─────────────────────────────────────────────────────────────────────────────
Admin endpoints.

Route groups:
    /admin/references      — Reference data (public)
    /admin/organisations   — Organisation list (Admin+)
    /admin/overview-stats  — Org counts + budgets by edu level (authenticated)
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.dependencies import (
    AuthenticatedUser,
    ReadDBSession,
    TokenPayload,
    require_permission,
    verify_token,
)
from app.models.finance import FinanceRecord
from app.models.organization import Organization, Region
from app.schemas.organization import (
    OrganizationListResponse,
    OrganizationResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


# ─────────────────────────────────────────────────────────────────────────────
# Reference data (public — used by frontend to populate dropdowns)
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/references/regions", summary="Регионы РК (публичный)")
async def list_regions(db: ReadDBSession) -> list[dict]:
    rows = (await db.execute(select(Region).order_by(Region.name_ru))).scalars().all()
    return [{"id": r.id, "code": r.code, "name_ru": r.name_ru, "type": r.type} for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Organisations CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/organisations",
    response_model=OrganizationListResponse,
    summary="Список организаций",
    dependencies=[Depends(require_permission("organizations.manage"))],
)
async def list_organizations(
    db: ReadDBSession,
    org_type_code: Optional[str] = Query(None),
    org_type_id:   Optional[int] = Query(None, ge=1, le=8),
    region_id:     Optional[int] = Query(None),
    status:        Optional[str] = Query(None, pattern="^(active|reorganized|liquidated)$"),
    search:        Optional[str] = Query(None, max_length=100),
    q:             Optional[str] = Query(None, max_length=100),
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _token: TokenPayload = Depends(verify_token),
) -> OrganizationListResponse:
    from sqlalchemy import or_
    from app.models.organization import OrgType as OrgTypeModel

    effective_search = search or q

    stmt = select(Organization).join(
        OrgTypeModel, OrgTypeModel.id == Organization.org_type_id, isouter=True
    )
    filters = []
    if org_type_code:
        filters.append(OrgTypeModel.code == org_type_code)
    if org_type_id:
        filters.append(Organization.org_type_id == org_type_id)
    if region_id:
        filters.append(Organization.region_id == region_id)
    if status:
        filters.append(Organization.status == status)
    if effective_search:
        filters.append(
            or_(
                Organization.name_ru.ilike(f"%{effective_search}%"),
                Organization.bin.ilike(f"{effective_search}%"),
            )
        )
    if filters:
        stmt = stmt.where(*filters)

    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar_one()

    rows = (
        await db.execute(
            stmt.order_by(Organization.name_ru).limit(limit).offset(offset)
        )
    ).scalars().all()

    return OrganizationListResponse(
        items=[OrganizationResponse.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Overview stats — org counts + budgets by education level
# ─────────────────────────────────────────────────────────────────────────────

# org_type_id → edu level key
_ORG_TYPE_LEVEL = {1: "do", 2: "dopo", 3: "so", 4: "tippo", 5: "vipo"}

@router.get("/overview-stats", summary="Статистика по уровням образования для вкладки Обзор")
async def overview_stats(db: ReadDBSession, _token: AuthenticatedUser) -> dict:
    # Org counts by org_type_id (only active, not deleted)
    count_rows = (
        await db.execute(
            select(Organization.org_type_id, func.count().label("cnt"))
            .where(Organization.status == "active")
            .group_by(Organization.org_type_id)
        )
    ).all()

    # Latest approved annual_budget per org, summed by org_type
    budget_rows = (
        await db.execute(
            select(Organization.org_type_id, func.coalesce(func.sum(FinanceRecord.annual_budget), 0).label("total"))
            .join(FinanceRecord, FinanceRecord.org_id == Organization.id)
            .where(
                Organization.status == "active",
                FinanceRecord.deleted_at.is_(None),
                FinanceRecord.submission_status == "approved",
            )
            .group_by(Organization.org_type_id)
        )
    ).all()

    budget_map: dict[int, float] = {r.org_type_id: float(r.total) for r in budget_rows if r.org_type_id}

    levels: dict = {}
    for r in count_rows:
        key = _ORG_TYPE_LEVEL.get(r.org_type_id)
        if not key:
            continue
        budget_tg = budget_map.get(r.org_type_id, 0.0)
        levels[key] = {
            "org_count":   r.cnt,
            "budget_mlrd": round(budget_tg / 1_000_000_000, 1),  # тг → млрд тг
        }

    # Fill missing levels with zeros
    for key in _ORG_TYPE_LEVEL.values():
        levels.setdefault(key, {"org_count": 0, "budget_mlrd": 0.0})

    return {"levels": levels}
