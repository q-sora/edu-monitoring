"""
api/v1/routers.py
─────────────────────────────────────────────────────────────────────────────
Builds all domain routers via the factory and exports them for main.py.

To add a new domain:
    1. Create ORM model, Pydantic schemas, and CRUD registry entry.
    2. Add 8 lines below (import + build_domain_router call).
    3. Add to DOMAIN_ROUTERS list.
    4. Register in main.py.
"""
from __future__ import annotations

from app.api.v1.router_factory import build_domain_router
from app.crud.registry import (
    contingent_crud,
    education_crud,
    finance_crud,
    graduates_crud,
    school_rating_crud,
)
from app.schemas.contingent import (
    ContingentListResponse,
    ContingentSnapshotCreate,
    ContingentSnapshotResponse,
    ContingentSnapshotUpdate,
)
from app.schemas.education import (
    EducationListResponse,
    EducationalProcessCreate,
    EducationalProcessResponse,
    EducationalProcessUpdate,
)
from app.schemas.finance import (
    FinanceListResponse,
    FinanceRecordCreate,
    FinanceRecordResponse,
    FinanceRecordUpdate,
)
from app.schemas.graduates import (
    GraduatesListResponse,
    GraduatesRecordCreate,
    GraduatesRecordResponse,
    GraduatesRecordUpdate,
)
from app.schemas.school_rating import (
    SchoolRatingListResponse,
    SchoolRatingCreate,
    SchoolRatingResponse,
    SchoolRatingUpdate,
)

# ── Contingent ────────────────────────────────────────────────────────────────
contingent_router = build_domain_router(
    resource_path="contingent",
    tag="Контингент студентов",
    crud=contingent_crud,
    create_schema=ContingentSnapshotCreate,
    update_schema=ContingentSnapshotUpdate,
    response_schema=ContingentSnapshotResponse,
    list_response_schema=ContingentListResponse,
)

# ── Finance ───────────────────────────────────────────────────────────────────
finance_router = build_domain_router(
    resource_path="finance",
    tag="Финансы и бюджет",
    crud=finance_crud,
    create_schema=FinanceRecordCreate,
    update_schema=FinanceRecordUpdate,
    response_schema=FinanceRecordResponse,
    list_response_schema=FinanceListResponse,
)

# ── Graduates ─────────────────────────────────────────────────────────────────
graduates_router = build_domain_router(
    resource_path="graduates",
    tag="Выпускники",
    crud=graduates_crud,
    create_schema=GraduatesRecordCreate,
    update_schema=GraduatesRecordUpdate,
    response_schema=GraduatesRecordResponse,
    list_response_schema=GraduatesListResponse,
)

# ── Educational Process ───────────────────────────────────────────────────────
education_router = build_domain_router(
    resource_path="education",
    tag="Образовательный процесс",
    crud=education_crud,
    create_schema=EducationalProcessCreate,
    update_schema=EducationalProcessUpdate,
    response_schema=EducationalProcessResponse,
    list_response_schema=EducationListResponse,
)

# ── School Rating ─────────────────────────────────────────────────────────────
school_rating_org_router = build_domain_router(
    resource_path="school-rating",
    tag="Рейтинг школ",
    crud=school_rating_crud,
    create_schema=SchoolRatingCreate,
    update_schema=SchoolRatingUpdate,
    response_schema=SchoolRatingResponse,
    list_response_schema=SchoolRatingListResponse,
)

# Exported for main.py include_router calls
DOMAIN_ROUTERS = [contingent_router, finance_router, graduates_router, education_router, school_rating_org_router]
