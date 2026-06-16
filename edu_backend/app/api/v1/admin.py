"""
api/v1/admin.py
─────────────────────────────────────────────────────────────────────────────
Admin + Superadmin endpoints.

Route groups:
    /admin/organisations         — CRUD for organisations (Admin+)
    /admin/pending-submissions   — Aggregated approval queue (Admin+)
    /admin/audit-log             — Audit trail viewer (Admin+)
    /admin/api-keys              — Token management (Superadmin only)
    /admin/insights              — AI analytics via Gemini (Management+)
    /admin/completeness          — Submission completeness per org (Admin+)
    /admin/references            — Reference data (public — no auth)
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    AdminOrSuper,
    AuthenticatedUser,
    CanApprove,
    DBSession,
    ReadDBSession,
    SuperadminOnly,
    TokenPayload,
    require_permission,
    require_role,
    verify_token,
    UserRole,
)
from app.models.contingent import ContingentSnapshot
from app.models.finance import FinanceRecord
from app.models.science import ScienceActivity
from app.models.organization import ApiToken, DataSource, Organization, OrgType, Region
from app.schemas.organization import (
    ApiTokenCreate,
    ApiTokenResponse,
    AuditLogEntry,
    AuditLogResponse,
    OrganizationCreate,
    OrganizationListResponse,
    OrganizationResponse,
    OrganizationUpdate,
    PendingSubmissionsResponse,
)
from app.services.ai_insights import InsightRequest, get_insights
from app.services.submission import get_completeness_score, get_pending_submissions
from app.schemas.presentation import (
    PresentationDetailResponse,
    PresentationRequest,
    PresentationStatus,
    PresentationStatusResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─────────────────────────────────────────────────────────────────────────────
# Reference data (public — used by frontend to populate dropdowns)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/references/org-types", summary="Типы организаций (публичный)")
async def list_org_types(db: ReadDBSession) -> list[dict]:
    rows = (await db.execute(select(OrgType).order_by(OrgType.id))).scalars().all()
    return [{"id": r.id, "code": r.code, "name_ru": r.name_ru} for r in rows]


@router.get("/references/regions", summary="Регионы РК (публичный)")
async def list_regions(db: ReadDBSession) -> list[dict]:
    rows = (await db.execute(select(Region).order_by(Region.name_ru))).scalars().all()
    return [{"id": r.id, "code": r.code, "name_ru": r.name_ru, "type": r.type} for r in rows]


@router.get("/references/data-sources", summary="Источники данных (публичный)")
async def list_data_sources(db: ReadDBSession) -> list[dict]:
    rows = (await db.execute(select(DataSource).order_by(DataSource.id))).scalars().all()
    return [{"id": r.id, "code": r.code, "name_ru": r.name_ru} for r in rows]


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


@router.post(
    "/organisations",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать организацию",
    dependencies=[Depends(require_permission("organizations.manage"))],
)
async def create_organization(
    body: OrganizationCreate,
    db: DBSession,
    token: TokenPayload = Depends(verify_token),
) -> OrganizationResponse:
    org = Organization(**body.model_dump(exclude_none=True))
    async with db.begin():
        db.add(org)
        await db.flush()
        await db.refresh(org)
    return OrganizationResponse.model_validate(org)


@router.get(
    "/organisations/{org_id}",
    response_model=OrganizationResponse,
    summary="Получить организацию",
)
async def get_organization(
    org_id: UUID,
    db: ReadDBSession,
    _token: TokenPayload = Depends(verify_token),
) -> OrganizationResponse:
    row = (
        await db.execute(select(Organization).where(Organization.id == org_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Organisation not found")
    return OrganizationResponse.model_validate(row)


@router.patch(
    "/organisations/{org_id}",
    response_model=OrganizationResponse,
    summary="Обновить организацию",
    dependencies=[Depends(require_permission("organizations.manage"))],
)
async def update_organization(
    org_id: UUID,
    body: OrganizationUpdate,
    db: DBSession,
    _token: TokenPayload = Depends(verify_token),
) -> OrganizationResponse:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

    async with db.begin():
        result = await db.execute(
            update(Organization)
            .where(Organization.id == org_id)
            .values(**updates)
            .returning(Organization)
        )
        org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Organisation not found")
    return OrganizationResponse.model_validate(org)


# ─────────────────────────────────────────────────────────────────────────────
# Pending submissions
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/pending-submissions",
    response_model=PendingSubmissionsResponse,
    summary="Данные на согласовании",
    description="""
    Aggregated view of all records across every domain table
    that are in `submitted` or `under_review` status.

    Admin sees all organisations; data_entry users are not allowed here.
    """,
    dependencies=[Depends(require_permission("data.approve"))],
)
async def list_pending_submissions(
    db: ReadDBSession,
    org_id:        Optional[UUID] = Query(None, description="Filter by org"),
    status_filter: str            = Query("submitted", pattern="^(submitted|under_review)$"),
    domain:        Optional[str]  = Query(None, description="Table name filter, e.g. finance_records"),
    year:          Optional[int]  = Query(None, ge=2010, le=2035),
    region_id:     Optional[int]  = Query(None, ge=1),
    limit:         int            = Query(50, ge=1, le=200),
    offset:        int            = Query(0, ge=0),
    _token: TokenPayload    = Depends(verify_token),
) -> PendingSubmissionsResponse:
    items, total = await get_pending_submissions(
        db,
        org_id=org_id,
        status_filter=status_filter,
        domain_filter=domain,
        year_filter=year,
        region_id=region_id,
        limit=limit,
        offset=offset,
    )
    return PendingSubmissionsResponse(items=items, total=total)


# ─────────────────────────────────────────────────────────────────────────────
# Submission completeness
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/completeness/{org_id}",
    summary="Полнота подачи данных организации",
    dependencies=[Depends(require_permission("data.view_all"))],
)
async def get_org_completeness(
    org_id: UUID,
    year:   int = Query(..., ge=2010, le=2035),
    db: ReadDBSession = None,
    _token: TokenPayload = Depends(verify_token),
) -> dict:
    return await get_completeness_score(db, org_id=org_id, year=year)


# ─────────────────────────────────────────────────────────────────────────────
# Coverage matrix — org × module status for a given year
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/coverage",
    summary="Матрица покрытия данных (org × модуль)",
    dependencies=[Depends(require_permission("data.view_all"))],
)
async def get_coverage_matrix(
    year:        int           = Query(2024, ge=2010, le=2035),
    region_id:   Optional[int] = Query(None, ge=1),
    org_type_id: Optional[int] = Query(None, ge=1, le=8),
    search:      Optional[str] = Query(None, max_length=100),
    limit:       int           = Query(50, ge=1, le=200),
    offset:      int           = Query(0, ge=0),
    db: ReadDBSession = None,
    _token: TokenPayload = Depends(verify_token),
) -> dict:
    from app.models.education import EducationalProcess
    from app.models.graduates import GraduatesRecord
    from sqlalchemy import or_

    org_stmt = select(Organization.id, Organization.name_ru)
    org_filters = []
    if region_id:
        org_filters.append(Organization.region_id == region_id)
    if org_type_id:
        org_filters.append(Organization.org_type_id == org_type_id)
    if search:
        org_filters.append(
            or_(
                Organization.name_ru.ilike(f"%{search}%"),
                Organization.bin.ilike(f"{search}%"),
            )
        )
    if org_filters:
        org_stmt = org_stmt.where(*org_filters)

    total_orgs = (await db.execute(
        select(func.count()).select_from(org_stmt.subquery())
    )).scalar_one()

    orgs = (
        await db.execute(
            org_stmt.order_by(Organization.name_ru).limit(limit).offset(offset)
        )
    ).all()

    # For each module, fetch (org_id → status) for the given year.
    # We take the "best" status per org using a priority order.
    status_priority = {"approved": 4, "under_review": 3, "submitted": 2, "draft": 1}

    def best(rows: list) -> dict:
        """rows = list of (org_id, submission_status) tuples"""
        result: dict = {}
        for row in rows:
            oid, st = str(row[0]), row[1]
            if oid not in result or status_priority.get(st, 0) > status_priority.get(result[oid], 0):
                result[oid] = st
        return result

    # Science
    sci_rows = (await db.execute(
        select(ScienceActivity.org_id, ScienceActivity.submission_status)
        .where(ScienceActivity.period_year == year, ScienceActivity.deleted_at.is_(None))
    )).all()

    # Contingent
    cont_rows = (await db.execute(
        select(ContingentSnapshot.org_id, ContingentSnapshot.submission_status)
        .where(
            func.extract("year", ContingentSnapshot.snapshot_date) == year,
            ContingentSnapshot.deleted_at.is_(None),
        )
    )).all()

    # Finance
    fin_rows = (await db.execute(
        select(FinanceRecord.org_id, FinanceRecord.submission_status)
        .where(FinanceRecord.period_year == year, FinanceRecord.deleted_at.is_(None))
    )).all()

    # Graduates (graduation_year == year)
    grad_rows = (await db.execute(
        select(GraduatesRecord.org_id, GraduatesRecord.submission_status)
        .where(GraduatesRecord.graduation_year == year, GraduatesRecord.deleted_at.is_(None))
    )).all()

    # Education process
    edu_rows = (await db.execute(
        select(EducationalProcess.org_id, EducationalProcess.submission_status)
        .where(
            func.extract("year", EducationalProcess.snapshot_date) == year,
            EducationalProcess.deleted_at.is_(None),
        )
    )).all()

    sci_map  = best(sci_rows)
    cont_map = best(cont_rows)
    fin_map  = best(fin_rows)
    grad_map = best(grad_rows)
    edu_map  = best(edu_rows)

    result_orgs = []
    total_cells = 0
    filled_cells = 0

    for org in orgs:
        oid = str(org.id)
        modules = {
            "contingent": cont_map.get(oid),
            "finance":    fin_map.get(oid),
            "science":    sci_map.get(oid),
            "graduates":  grad_map.get(oid),
            "education":  edu_map.get(oid),
        }
        total_cells += len(modules)
        filled_cells += sum(1 for v in modules.values() if v is not None)
        approved_count = sum(1 for v in modules.values() if v == "approved")
        result_orgs.append({
            "id":       oid,
            "name_ru":  org.name_ru,
            "modules":  modules,
            "approved": approved_count,
            "total":    len(modules),
        })

    return {
        "year":          year,
        "organizations": result_orgs,
        "total":         total_orgs,
        "limit":         limit,
        "offset":        offset,
        "summary": {
            "orgs_total":     total_orgs,
            "cells_total":    total_cells,
            "cells_filled":   filled_cells,
            "cells_approved": sum(
                sum(1 for v in o["modules"].values() if v == "approved")
                for o in result_orgs
            ),
            "coverage_pct": round(filled_cells / total_cells * 100) if total_cells else 0,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Transparency — comparative metrics across organisations
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/transparency",
    summary="Данные для раздела Прозрачность",
)
async def get_transparency_data(
    year: int = Query(2024, ge=2010, le=2035),
    region_id:   Optional[int] = Query(None, ge=1, description="Фильтр по региону"),
    org_type_id: Optional[int] = Query(None, ge=1, le=8, description="Фильтр по типу организации"),
    db: ReadDBSession = None,
) -> dict:
    """
    Public-ish endpoint (no permission check — management role can access).
    Returns per-organisation efficiency metrics for the given year.
    Joins finance_records + contingent_snapshots + graduates_records + science_activity.
    """
    from app.models.graduates import GraduatesRecord
    from decimal import Decimal

    org_stmt = select(
        Organization.id, Organization.name_ru,
        Organization.org_type_id, Organization.region_id,
    ).order_by(Organization.name_ru)
    if region_id is not None:
        org_stmt = org_stmt.where(Organization.region_id == region_id)
    if org_type_id is not None:
        org_stmt = org_stmt.where(Organization.org_type_id == org_type_id)

    orgs = (await db.execute(org_stmt)).all()

    # Fetch all data for the year in bulk
    fin_rows = (await db.execute(
        select(FinanceRecord)
        .where(
            FinanceRecord.period_year == year,
            FinanceRecord.period_month.is_(None),  # annual only
            FinanceRecord.submission_status == "approved",
            FinanceRecord.deleted_at.is_(None),
        )
    )).scalars().all()
    fin_map = {str(r.org_id): r for r in fin_rows}

    cont_rows = (await db.execute(
        select(ContingentSnapshot)
        .where(
            func.extract("year", ContingentSnapshot.snapshot_date) == year,
            ContingentSnapshot.submission_status == "approved",
            ContingentSnapshot.deleted_at.is_(None),
        )
        .order_by(ContingentSnapshot.snapshot_date.desc())
    )).scalars().all()
    # Take the most recent snapshot per org
    cont_map: dict = {}
    for r in cont_rows:
        oid = str(r.org_id)
        if oid not in cont_map:
            cont_map[oid] = r

    grad_rows = (await db.execute(
        select(GraduatesRecord)
        .where(
            GraduatesRecord.graduation_year == year,
            GraduatesRecord.submission_status == "approved",
            GraduatesRecord.deleted_at.is_(None),
        )
    )).scalars().all()
    grad_map = {str(r.org_id): r for r in grad_rows}

    sci_rows = (await db.execute(
        select(ScienceActivity)
        .where(
            ScienceActivity.period_year == year,
            ScienceActivity.submission_status == "approved",
            ScienceActivity.deleted_at.is_(None),
        )
    )).scalars().all()
    sci_map = {str(r.org_id): r for r in sci_rows}

    def to_float(v) -> float | None:
        if v is None:
            return None
        return float(v) if isinstance(v, Decimal) else v

    result = []
    for org in orgs:
        oid = str(org.id)
        fin  = fin_map.get(oid)
        cont = cont_map.get(oid)
        grad = grad_map.get(oid)
        sci  = sci_map.get(oid)

        budget     = to_float(fin.annual_budget)    if fin  else None
        payroll    = to_float(fin.expenses_payroll) if fin  else None
        rnd        = to_float(fin.expenses_rnd)     if fin  else None
        state_ord  = to_float(fin.state_order_volume) if fin else None
        students   = cont.total_count               if cont else None
        budget_st  = cont.budget_count              if cont else None
        grad_total      = grad.graduates_total           if grad else None
        employed_6m_pct = to_float(grad.employed_6m_pct) if grad else None

        cost_per_student = round(budget / students) if budget and students else None
        payroll_pct      = round(payroll / budget * 100, 1) if payroll and budget else None
        grant_pct        = round(budget_st / students * 100, 1) if budget_st and students else None
        employment_rate  = round(employed_6m_pct, 1) if employed_6m_pct is not None else None
        rnd_pct          = round(rnd / budget * 100, 1) if rnd and budget else None

        result.append({
            "id":              oid,
            "name_ru":         org.name_ru,
            "org_type_id":     org.org_type_id,
            "region_id":       org.region_id,
            "budget":          budget,
            "students":        students,
            "cost_per_student": cost_per_student,
            "payroll_pct":     payroll_pct,
            "grant_pct":       grant_pct,
            "employment_rate": employment_rate,
            "rnd_pct":         rnd_pct,
            "state_order":     state_ord,
            "h_index_avg":     float(sci.hirsch_index_avg) if sci and sci.hirsch_index_avg else None,
            "publications_scopus": sci.publications_scopus if sci else None,
            "publications_wos":    sci.publications_wos    if sci else None,
        })

    # Aggregate totals
    valid_costs = [r["cost_per_student"] for r in result if r["cost_per_student"]]
    valid_payroll = [r["payroll_pct"] for r in result if r["payroll_pct"]]
    valid_grants  = [r["grant_pct"] for r in result if r["grant_pct"]]
    valid_employ  = [r["employment_rate"] for r in result if r["employment_rate"]]

    return {
        "year": year,
        "organizations": result,
        "averages": {
            "cost_per_student": round(sum(valid_costs) / len(valid_costs)) if valid_costs else None,
            "payroll_pct":      round(sum(valid_payroll) / len(valid_payroll), 1) if valid_payroll else None,
            "grant_pct":        round(sum(valid_grants) / len(valid_grants), 1) if valid_grants else None,
            "employment_rate":  round(sum(valid_employ) / len(valid_employ), 1) if valid_employ else None,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Regional stats — для карты Казахстана в разделе Прозрачность
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/regional-stats",
    summary="Статистика по регионам (для карты)",
)
async def get_regional_stats(
    year: int         = Query(2024, ge=2010, le=2035),
    org_type_id: Optional[int] = Query(None, ge=1, le=7, description="ID типа организации; None = все уровни"),
    db: ReadDBSession = None,
    _token: TokenPayload = Depends(require_role("superadmin", "admin", "management")),
) -> dict:
    """
    Агрегирует contingent_snapshots и finance_records по region_id.
    Поддерживает фильтр по типу организации (уровню образования).
    Ответ: { region_id: { total_students, budget, org_count, name_ru } }
    """
    from decimal import Decimal

    # Организации с region_id (опционально фильтрованные по org_type)
    org_stmt = select(Organization.id, Organization.region_id).where(
        Organization.region_id.isnot(None)
    )
    if org_type_id is not None:
        org_stmt = org_stmt.where(Organization.org_type_id == org_type_id)
    org_rows = (await db.execute(org_stmt)).all()
    org_to_region: dict[str, int] = {str(r.id): r.region_id for r in org_rows}
    org_ids = list(org_to_region.keys())

    if not org_ids:
        # нет организаций по данному фильтру — вернём пустые записи по регионам
        region_rows = (await db.execute(select(Region))).scalars().all()
        return {
            str(r.id): {"total_students": 0, "budget": 0.0, "org_count": 0, "name_ru": r.name_ru}
            for r in region_rows
        }

    from sqlalchemy import cast
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID_TYPE

    org_uuids = [__import__("uuid").UUID(oid) for oid in org_ids]

    # Контингент — последний approved snapshot за год по каждой org_id
    cont_rows = (await db.execute(
        select(ContingentSnapshot.org_id, ContingentSnapshot.total_count)
        .where(
            func.extract("year", ContingentSnapshot.snapshot_date) == year,
            ContingentSnapshot.submission_status == "approved",
            ContingentSnapshot.deleted_at.is_(None),
            ContingentSnapshot.org_id.in_(org_uuids),
        )
        .order_by(ContingentSnapshot.snapshot_date.desc())
    )).all()
    cont_map: dict[str, int] = {}
    for r in cont_rows:
        k = str(r.org_id)
        if k not in cont_map and r.total_count is not None:
            cont_map[k] = r.total_count

    # Финансы — annual, approved
    fin_rows = (await db.execute(
        select(FinanceRecord.org_id, FinanceRecord.annual_budget)
        .where(
            FinanceRecord.period_year == year,
            FinanceRecord.period_month.is_(None),
            FinanceRecord.submission_status == "approved",
            FinanceRecord.deleted_at.is_(None),
            FinanceRecord.org_id.in_(org_uuids),
        )
    )).all()
    fin_map: dict[str, Decimal | None] = {str(r.org_id): r.annual_budget for r in fin_rows}

    # Справочник регионов
    region_rows = (await db.execute(select(Region))).scalars().all()
    region_names: dict[int, str] = {r.id: r.name_ru for r in region_rows}

    # Агрегируем по region_id (инициализируем все 20 регионов нулями)
    agg: dict[int, dict] = {
        r.id: {"total_students": 0, "budget": Decimal(0), "org_count": 0, "name_ru": r.name_ru}
        for r in region_rows
    }

    for org_id_str, region_id in org_to_region.items():
        if region_id not in agg:
            continue
        agg[region_id]["org_count"] += 1
        students = cont_map.get(org_id_str)
        if students:
            agg[region_id]["total_students"] += students
        budget = fin_map.get(org_id_str)
        if budget:
            agg[region_id]["budget"] += budget

    return {
        str(region_id): {
            "total_students": v["total_students"],
            "budget": float(v["budget"]) if v["budget"] else 0.0,
            "org_count": v["org_count"],
            "name_ru": v["name_ru"],
        }
        for region_id, v in agg.items()
    }


# ─────────────────────────────────────────────────────────────────────────────
# Audit log
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/audit-log",
    response_model=AuditLogResponse,
    summary="Журнал аудита",
    description="""
    Returns rows from the `audit_log` table with full before/after snapshots.
    Supports filtering by table, org, action, and time range.

    **Performance note**: audit_log can become very large.  Always filter by
    at least one indexed column (table_name, org_id, or changed_at range).
    """,
    dependencies=[Depends(require_permission("audit.view"))],
)
async def get_audit_log(
    db: ReadDBSession,
    table_name: Optional[str]     = Query(None),
    org_id:     Optional[UUID]    = Query(None),
    action:     Optional[str]     = Query(None, pattern="^(INSERT|UPDATE|DELETE)$"),
    from_dt:    Optional[datetime] = Query(None),
    to_dt:      Optional[datetime] = Query(None),
    changed_by: Optional[str]     = Query(None),
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _token: TokenPayload = Depends(verify_token),
) -> AuditLogResponse:
    from app.models.mixins import AuditLog

    filters = []
    if table_name:
        filters.append(AuditLog.table_name == table_name)
    if org_id:
        filters.append(AuditLog.org_id == str(org_id))
    if action:
        filters.append(AuditLog.action == action)
    if from_dt:
        filters.append(AuditLog.changed_at >= from_dt)
    if to_dt:
        filters.append(AuditLog.changed_at <= to_dt)
    if changed_by:
        filters.append(AuditLog.changed_by == changed_by)

    base_stmt = select(AuditLog)
    if filters:
        base_stmt = base_stmt.where(*filters)

    total = (
        await db.execute(select(func.count()).select_from(base_stmt.subquery()))
    ).scalar_one()

    rows = (
        await db.execute(
            base_stmt
            .order_by(AuditLog.changed_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    return AuditLogResponse(
        items=[AuditLogEntry.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


# ─────────────────────────────────────────────────────────────────────────────
# AI Insights
# ─────────────────────────────────────────────────────────────────────────────

class InsightQueryRequest(BaseModel):
    query:          str            = "Найди аномалии и тренды в данных за последние 3 года."
    org_id:         Optional[UUID] = None
    region_id:      Optional[int]  = None
    org_type_id:    Optional[int]  = None
    year:           Optional[int]  = None
    include_tables: list[str]      = ["science_activity", "contingent_snapshots", "finance_records"]
    force_refresh:  bool           = False


@router.post(
    "/insights",
    summary="AI аналитика (Gemini)",
    dependencies=[Depends(require_permission("ai_insights.view"))],
)
async def query_ai_insights(
    body: InsightQueryRequest,
    db: ReadDBSession,
    token: TokenPayload = Depends(verify_token),
) -> dict:
    if token.role == UserRole.DATA_ENTRY and body.org_id != UUID(token.org_id or ""):
        raise HTTPException(403, "You can only query your own organisation's data.")

    result = await get_insights(
        db,
        request=InsightRequest(
            query=body.query,
            org_id=body.org_id,
            region_id=body.region_id,
            org_type_id=body.org_type_id,
            year=body.year,
            include_tables=body.include_tables,
        ),
        force_refresh=body.force_refresh,
    )
    d = result.to_dict()

    # Save to history (fire-and-forget — don't let DB error break the response)
    try:
        import json as _json
        from app.core.database import get_db_context
        async with get_db_context() as write_db:
            await write_db.execute(
                text("""
                    INSERT INTO ai_insight_history
                        (requested_by, query, org_id, region_id, org_type_id, year,
                         include_tables, summary, anomalies, recommendations,
                         model_used, context_rows)
                    VALUES
                        (:user_id, :query, :org_id, :region_id, :org_type_id, :year,
                         :tables, :summary, CAST(:anomalies AS jsonb), CAST(:recs AS jsonb),
                         :model_used, :context_rows)
                """),
                {
                    "user_id":     token.sub,
                    "query":       body.query,
                    "org_id":      str(body.org_id) if body.org_id else None,
                    "region_id":   body.region_id,
                    "org_type_id": body.org_type_id,
                    "year":        body.year,
                    "tables":      body.include_tables,
                    "summary":     d["summary"],
                    "anomalies":   _json.dumps(d["anomalies"], ensure_ascii=False),
                    "recs":        _json.dumps(d["recommendations"], ensure_ascii=False),
                    "model_used":  d.get("model_used", ""),
                    "context_rows": d.get("context_rows", 0),
                },
            )
            await write_db.commit()
    except Exception as exc:
        logger.warning("Failed to save insight history: %s", exc)

    return d


@router.get(
    "/insights/history",
    summary="История AI инсайтов",
    dependencies=[Depends(require_permission("ai_insights.view"))],
)
async def get_insight_history(
    db: ReadDBSession,
    token: TokenPayload = Depends(verify_token),
    limit: int = 30,
) -> list[dict]:
    rows = (await db.execute(
        text("""
            SELECT h.id, h.query, h.org_id::text, h.region_id, h.org_type_id,
                   h.year, h.include_tables, h.summary, h.anomalies,
                   h.recommendations, h.model_used, h.context_rows,
                   h.created_at,
                   r.name_ru AS region_name,
                   ot.name_ru AS org_type_name
            FROM   ai_insight_history h
            LEFT JOIN regions   r  ON r.id  = h.region_id
            LEFT JOIN org_types ot ON ot.id = h.org_type_id
            WHERE  h.requested_by = :user_id
            ORDER  BY h.created_at DESC
            LIMIT  :limit
        """),
        {"user_id": token.sub, "limit": limit},
    )).mappings().all()

    return [
        {
            "id":               r["id"],
            "query":            r["query"],
            "region_id":        r["region_id"],
            "org_type_id":      r["org_type_id"],
            "year":             r["year"],
            "include_tables":   r["include_tables"] or [],
            "summary":          r["summary"],
            "anomalies":        r["anomalies"] or [],
            "recommendations":  r["recommendations"] or [],
            "model_used":       r["model_used"],
            "context_rows":     r["context_rows"],
            "created_at":       r["created_at"].isoformat(),
            "region_name":      r["region_name"],
            "org_type_name":    r["org_type_name"],
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# API Keys  (superadmin only)
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/api-keys",
    response_model=list[ApiTokenResponse],
    summary="Список API ключей (Суперадмин)",
)
async def list_api_keys(
    db: ReadDBSession,
    _token: SuperadminOnly,
) -> list[ApiTokenResponse]:
    rows = (
        await db.execute(
            select(ApiToken)
            .where(ApiToken.is_active.is_(True))
            .order_by(ApiToken.created_at.desc())
        )
    ).scalars().all()
    return [ApiTokenResponse.model_validate(r) for r in rows]


@router.post(
    "/api-keys",
    response_model=ApiTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать API ключ (Суперадмин)",
    description="""
    Generates a cryptographically secure API token.

    **Security**: The raw token is returned ONCE in this response.
    Only a bcrypt hash is stored in the database.
    If the token is lost, it must be revoked and a new one created.
    """,
)
async def create_api_key(
    body: ApiTokenCreate,
    db: DBSession,
    _token: SuperadminOnly,
) -> ApiTokenResponse:
    raw_token = f"edu_sk_live_{secrets.token_urlsafe(32)}"
    token_hash = _pwd.hash(raw_token)

    expires_at = None
    if body.expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    record = ApiToken(
        token_hash=token_hash,
        org_id=body.org_id,
        name=body.name,
        scopes=body.scopes,
        is_active=True,
        expires_at=expires_at,
    )
    async with db.begin():
        db.add(record)
        await db.flush()
        await db.refresh(record)

    resp = ApiTokenResponse.model_validate(record)
    resp.raw_token = raw_token   # shown ONCE
    return resp


@router.delete(
    "/api-keys/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Отозвать API ключ (Суперадмин)",
)
async def revoke_api_key(
    token_id: int,
    db: DBSession,
    _token: SuperadminOnly,
) -> Response:
    async with db.begin():
        result = await db.execute(
            update(ApiToken)
            .where(ApiToken.id == token_id)
            .values(is_active=False)
        )
    if result.rowcount == 0:
        raise HTTPException(404, "API key not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# System stats (superadmin dashboard)
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/stats",
    summary="Системная статистика (Суперадмин)",
    description="Returns record counts, pending counts, and cache stats.",
)
async def system_stats(
    db: ReadDBSession,
    _token: AdminOrSuper,
) -> dict:
    from app.models.contingent import ContingentSnapshot
    from app.models.science import ScienceActivity
    from app.models.finance import FinanceRecord

    PENDING_STATUSES = ("submitted", "under_review")

    org_count = (await db.execute(select(func.count()).select_from(Organization))).scalar_one()

    # Total students across all approved contingent snapshots
    total_students = (
        await db.execute(
            select(func.coalesce(func.sum(ContingentSnapshot.total_count), 0))
            .where(
                ContingentSnapshot.submission_status == "approved",
                ContingentSnapshot.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    # Records pending review (submitted + under_review)
    pending_science = (
        await db.execute(
            select(func.count())
            .select_from(ScienceActivity)
            .where(
                ScienceActivity.submission_status.in_(PENDING_STATUSES),
                ScienceActivity.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    pending_contingent = (
        await db.execute(
            select(func.count())
            .select_from(ContingentSnapshot)
            .where(
                ContingentSnapshot.submission_status.in_(PENDING_STATUSES),
                ContingentSnapshot.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    from app.core.redis_client import get_redis
    redis = get_redis()
    redis_info = await redis.info("server")

    return {
        "organizations":      org_count,
        "total_students":     int(total_students),
        "pending_science":    pending_science,
        "pending_contingent": pending_contingent,
        "redis_version":      redis_info.get("redis_version"),
        "uptime_seconds":     redis_info.get("uptime_in_seconds"),
    }


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


# ─────────────────────────────────────────────────────────────────────────────
# Superset guest token proxy
# ─────────────────────────────────────────────────────────────────────────────

SUPERSET_DASHBOARDS = [
    {
        "id":            2,
        "title":         "Контингент обучающихся",
        "description":   "Численность студентов, структура по формам и источникам финансирования, льготные категории",
        "embedded_uuid": "a1b2c3d4-0001-4aaa-b001-100000000001",
    },
    {
        "id":            3,
        "title":         "Финансирование и бюджет",
        "description":   "Бюджеты, структура расходов, ФОТ преподавательского и административного персонала",
        "embedded_uuid": "a1b2c3d4-0002-4aaa-b002-100000000002",
    },
    {
        "id":            4,
        "title":         "Наука и исследования",
        "description":   "Публикации Scopus/WoS, квартили, индекс Хирша, финансирование грантов",
        "embedded_uuid": "a1b2c3d4-0003-4aaa-b003-100000000003",
    },
    {
        "id":            5,
        "title":         "Выпускники и трудоустройство",
        "description":   "Уровень трудоустройства, динамика зарплат и распределение по секторам экономики",
        "embedded_uuid": "a1b2c3d4-0004-4aaa-b004-100000000004",
    },
    {
        "id":            6,
        "title":         "Образовательный процесс",
        "description":   "Преподавательский состав, качество обучения, аккредитованные программы",
        "embedded_uuid": "a1b2c3d4-0005-4aaa-b005-100000000005",
    },
]


@router.get("/superset/dashboards")
async def list_superset_dashboards(
    _token: TokenPayload = Depends(require_role("superadmin", "admin", "management")),
):
    return {"result": SUPERSET_DASHBOARDS}


@router.get("/superset/guest-token/{dashboard_id}")
async def get_superset_guest_token(
    dashboard_id: int,
    _token: TokenPayload = Depends(require_role("superadmin", "admin", "management")),
):
    from app.core.config import settings

    dashboard = next((d for d in SUPERSET_DASHBOARDS if d["id"] == dashboard_id), None)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    base = settings.SUPERSET_URL
    if not settings.SUPERSET_ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Superset not configured",
        )

    import httpx

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Step 1: login
        login_resp = await client.post(
            f"{base}/api/v1/security/login",
            json={
                "username": settings.SUPERSET_ADMIN_USER,
                "password": settings.SUPERSET_ADMIN_PASSWORD,
                "provider": "db",
            },
        )
        if login_resp.status_code != 200:
            logger.error("Superset login failed: %d", login_resp.status_code)
            raise HTTPException(status_code=502, detail="Superset login failed")

        access_token = login_resp.json()["access_token"]
        auth_header = {"Authorization": f"Bearer {access_token}"}

        # Step 2: CSRF token
        csrf_resp = await client.get(
            f"{base}/api/v1/security/csrf_token/",
            headers=auth_header,
        )
        csrf_token = csrf_resp.json().get("result", "")
        cookies = dict(csrf_resp.cookies)

        # Step 3: guest token
        guest_resp = await client.post(
            f"{base}/api/v1/security/guest_token/",
            headers={**auth_header, "X-CSRFToken": csrf_token, "Referer": base},
            cookies=cookies,
            json={
                "user": {"username": "portal_guest", "first_name": "Portal", "last_name": "Guest"},
                "resources": [{"type": "dashboard", "id": dashboard["embedded_uuid"]}],
                "rls": [],
            },
        )

    if guest_resp.status_code != 200:
        logger.error("Guest token error %d: %s", guest_resp.status_code, guest_resp.text[:200])
        raise HTTPException(status_code=502, detail="Could not obtain guest token")

    return {
        "token": guest_resp.json()["token"],
        "embedded_uuid": dashboard["embedded_uuid"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# AI Presentation Reports
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/presentations",
    response_model=PresentationStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Запустить генерацию AI-презентации",
    dependencies=[Depends(require_permission("ai_insights.view"))],
)
async def create_presentation(
    body: PresentationRequest,
    db: DBSession,
    token: TokenPayload = Depends(verify_token),
) -> PresentationStatusResponse:
    """
    Создаёт запись в evaluation_reports и запускает Celery-задачу.
    Возвращает report_id и celery_task_id для последующего polling.
    """
    from app.workers.tasks import build_ai_presentation

    row = await db.execute(
        text("""
            INSERT INTO evaluation_reports
                (org_id, requested_by, status, period_year, focus, region_id, org_type_id, created_at, updated_at)
            VALUES
                (:org_id, :requested_by, 'pending', :year, :focus, :region_id, :org_type_id, NOW(), NOW())
            RETURNING id, status, created_at
        """),
        {
            "org_id":      str(body.org_id) if body.org_id else None,
            "requested_by": token.sub,
            "year":        body.period_year,
            "focus":       body.focus,
            "region_id":   body.region_id,
            "org_type_id": body.org_type_id,
        },
    )
    await db.commit()
    rec = row.fetchone()
    report_id, _, created_at = rec[0], rec[1], rec[2]

    task = build_ai_presentation.delay(
        report_id=report_id,
        period_year=body.period_year,
        requested_by=token.sub,
        org_id=str(body.org_id) if body.org_id else None,
        region_id=body.region_id,
        org_type_id=body.org_type_id,
        focus=body.focus,
    )

    await db.execute(
        text("UPDATE evaluation_reports SET celery_task_id = :tid WHERE id = :id"),
        {"tid": task.id, "id": report_id},
    )
    await db.commit()

    logger.info("Presentation %d dispatched as Celery task %s", report_id, task.id)

    return PresentationStatusResponse(
        report_id=report_id,
        status=PresentationStatus.PENDING,
        celery_task_id=task.id,
        created_at=created_at,
    )


@router.get(
    "/presentations/{report_id}",
    response_model=PresentationDetailResponse,
    summary="Получить статус / результат AI-презентации",
    dependencies=[Depends(require_permission("ai_insights.view"))],
)
async def get_presentation(
    report_id: int,
    db: ReadDBSession,
    _token: TokenPayload = Depends(verify_token),
) -> PresentationDetailResponse:
    """
    Polling endpoint. Пока status != done | failed — возвращает текущий статус.
    Когда done — возвращает полный PresentationReport в поле report.
    """
    import json as _json
    from app.schemas.presentation import PresentationReport

    row = await db.execute(
        text("""
            SELECT id, status, celery_task_id, created_at, slides_json, error_message
            FROM evaluation_reports
            WHERE id = :id
        """),
        {"id": report_id},
    )
    rec = row.fetchone()
    if not rec:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    rid, st, task_id, created_at, slides_json, error_msg = rec

    report_obj: Optional[PresentationReport] = None
    if st == "done" and slides_json:
        try:
            report_obj = PresentationReport.model_validate(
                slides_json if isinstance(slides_json, dict) else _json.loads(slides_json)
            )
        except Exception as exc:
            logger.warning("Ошибка десериализации PresentationReport %d: %s", rid, exc)

    return PresentationDetailResponse(
        report_id=rid,
        status=PresentationStatus(st),
        celery_task_id=task_id,
        created_at=created_at,
        report=report_obj,
        error_message=error_msg,
    )


@router.get(
    "/presentations",
    summary="Список AI-презентаций",
    dependencies=[Depends(require_permission("ai_insights.view"))],
)
async def list_presentations(
    db: ReadDBSession,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _token: TokenPayload = Depends(verify_token),
) -> dict:
    """Возвращает историю сгенерированных презентаций (без slides_json)."""
    rows = await db.execute(
        text("""
            SELECT id, status, period_year, focus, region_id, org_type_id,
                   celery_task_id, created_at, error_message,
                   org_id::text
            FROM evaluation_reports
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"limit": limit, "offset": offset},
    )
    total_row = await db.execute(text("SELECT COUNT(*) FROM evaluation_reports"))
    total = total_row.scalar() or 0

    items = []
    for r in rows.fetchall():
        items.append({
            "report_id":      r[0],
            "status":         r[1],
            "period_year":    r[2],
            "focus":          r[3],
            "region_id":      r[4],
            "org_type_id":    r[5],
            "celery_task_id": r[6],
            "created_at":     r[7].isoformat() if r[7] else None,
            "error_message":  r[8],
            "org_id":         r[9],
        })

    return {"total": total, "items": items}
