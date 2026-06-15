"""
===============================================================
 EDU MONITORING API  —  FastAPI + SQLAlchemy + PostgreSQL
 Единая база данных мониторинга системы образования РК
===============================================================

Установка:
    pip install fastapi uvicorn sqlalchemy asyncpg python-dotenv pydantic

Запуск:
    uvicorn api:app --reload --port 8000

Документация: http://localhost:8000/docs
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Security, Header, Response, Request, File, Form, UploadFile
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from edu_backend.app.crud.college_assessment_import import parse_and_import_college_assessment

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
load_dotenv()

DEFAULT_DATABASE_URL = "postgresql+asyncpg://edu_user:strongpassword@localhost:5432/edu_monitoring"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
IS_SQLITE = DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    engine = create_async_engine(DATABASE_URL, echo=False)
else:
    engine = create_async_engine(DATABASE_URL, echo=False, pool_size=10, max_overflow=20)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

app = FastAPI(
    title="EDU Monitoring API",
    description="Единая база данных мониторинга системы образования РК",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

DEFAULT_ORG_ID = "11000000-0000-0000-0000-000000000001"

SEED_REGIONS = [
    (1, "AST", "Астана", "city"),
    (2, "ALA", "Алматы", "city"),
    (3, "SHY", "Шымкент", "city"),
    (4, "AKM", "Акмолинская", "oblast"),
    (5, "AKT", "Актюбинская", "oblast"),
    (6, "ALM", "Алматинская", "oblast"),
    (7, "ATY", "Атырауская", "oblast"),
    (8, "ZKZ", "Западно-Казахстанская", "oblast"),
    (9, "ZHB", "Жамбылская", "oblast"),
    (10, "ZHT", "Жетысу", "oblast"),
    (11, "KAR", "Карагандинская", "oblast"),
    (12, "KOS", "Костанайская", "oblast"),
    (13, "KZO", "Кызылординская", "oblast"),
    (14, "MAN", "Мангистауская", "oblast"),
    (15, "PAV", "Павлодарская", "oblast"),
    (16, "SKZ", "Северо-Казахстанская", "oblast"),
    (17, "TUR", "Туркестанская", "oblast"),
    (18, "ULT", "Улытау", "oblast"),
    (19, "ABY", "Абай", "oblast"),
    (20, "EKB", "Восточно-Казахстанская", "oblast"),
]

SEED_ORGANIZATIONS = [
    (DEFAULT_ORG_ID, "040000000001", "КазНУ им. аль-Фараби", 5, 2, 2),
    ("11000000-0000-0000-0000-000000000002", "010000000002", "ЕНУ им. Л.Н. Гумилёва", 5, 1, 2),
    ("11000000-0000-0000-0000-000000000003", "040000000003", "КазНТУ им. К.И. Сатпаева", 5, 2, 2),
    ("11000000-0000-0000-0000-000000000004", "010000000004", "Назарбаев Университет", 5, 1, 5),
]


def db_uuid(value: Any) -> Any:
    if value is None or IS_SQLITE:
        return value
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def api_id(value: Any) -> Optional[str]:
    return str(value) if value is not None else None


def jsonable(value: Any) -> Any:
    if isinstance(value, (date, datetime, UUID)):
        return str(value)
    return value


def int_or_none(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def decode_payload(value: Any) -> Dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return dict(value)
    return json.loads(value or "{}")


# ──────────────────────────────────────────────
# DEPENDENCIES
# ──────────────────────────────────────────────
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def ensure_local_schema() -> None:
    async with engine.begin() as conn:
        if IS_SQLITE:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS form_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    org_id TEXT NOT NULL,
                    domain TEXT NOT NULL,
                    period_year INTEGER,
                    period_month INTEGER,
                    period_quarter INTEGER,
                    snapshot_date TEXT,
                    academic_year INTEGER,
                    payload_json TEXT NOT NULL,
                    submission_status TEXT NOT NULL DEFAULT 'draft',
                    submitted_at TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_by TEXT
                )
            """))
        else:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS form_records (
                    id SERIAL PRIMARY KEY,
                    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                    domain TEXT NOT NULL,
                    period_year INTEGER,
                    period_month INTEGER,
                    period_quarter INTEGER,
                    snapshot_date DATE,
                    academic_year INTEGER,
                    payload_json JSONB NOT NULL,
                    submission_status TEXT NOT NULL DEFAULT 'draft',
                    submitted_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_by TEXT
                )
            """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_form_records_org_domain
            ON form_records (org_id, domain, updated_at)
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_form_records_status
            ON form_records (submission_status, updated_at)
        """))
        if IS_SQLITE:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    method TEXT NOT NULL,
                    path TEXT NOT NULL,
                    user_email TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
        else:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id BIGSERIAL PRIMARY KEY,
                    method TEXT NOT NULL,
                    path TEXT NOT NULL,
                    user_email TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS college_assessment (
                    id BIGSERIAL PRIMARY KEY,
                    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
                    college_id_source INTEGER,
                    region VARCHAR(100),
                    district VARCHAR(100),
                    college_name TEXT NOT NULL,
                    ownership_form VARCHAR(100),
                    location_type VARCHAR(50),
                    period_year INTEGER NOT NULL,
                    source_file VARCHAR(255),
                    imported_at TIMESTAMPTZ DEFAULT NOW(),
                    imported_by UUID,
                    repair_current_done BOOLEAN,
                    repair_not_required BOOLEAN,
                    repair_capital_done BOOLEAN,
                    repair_capital_needed BOOLEAN,
                    repair_current_needed BOOLEAN,
                    score_repair NUMERIC(5,2),
                    capacity_design INTEGER,
                    contingent_actual INTEGER,
                    capacity_pct NUMERIC(6,2),
                    score_capacity NUMERIC(5,2),
                    attestation_result VARCHAR(50),
                    score_attestation NUMERIC(5,2),
                    has_sports_facility BOOLEAN,
                    score_sports NUMERIC(5,2),
                    has_dormitory BOOLEAN,
                    score_dormitory NUMERIC(5,2),
                    library_readers_count INTEGER,
                    library_readers_pct NUMERIC(6,2),
                    score_library NUMERIC(5,2),
                    mini_enterprise_count INTEGER,
                    score_mini_enterprise NUMERIC(5,2),
                    mini_enterprise_income NUMERIC(15,2),
                    score_mini_enterprise_income NUMERIC(5,2),
                    sponsor_funds NUMERIC(15,2),
                    score_sponsors NUMERIC(5,2),
                    has_methodical_union BOOLEAN,
                    score_methodical_union NUMERIC(5,2),
                    teachers_master_count INTEGER,
                    teachers_master_pct NUMERIC(6,2),
                    score_teachers_master NUMERIC(5,2),
                    teachers_science_count INTEGER,
                    teachers_science_pct NUMERIC(6,2),
                    score_teachers_science NUMERIC(5,2),
                    teachers_total INTEGER,
                    talap_trainers_count INTEGER,
                    score_talap_trainers NUMERIC(5,2),
                    best_teacher_winners INTEGER,
                    score_best_teacher NUMERIC(5,2),
                    enterprise_patronage_count INTEGER,
                    score_patronage NUMERIC(5,2),
                    total_score NUMERIC(6,2),
                    UNIQUE (college_name, region, period_year)
                )
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ca_region ON college_assessment (region)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ca_year ON college_assessment (period_year)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ca_org ON college_assessment (org_id)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ca_score ON college_assessment (total_score DESC)"))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS college_assessment_specialty (
                    id BIGSERIAL PRIMARY KEY,
                    assessment_id BIGINT NOT NULL REFERENCES college_assessment(id) ON DELETE CASCADE,
                    specialty_raw TEXT NOT NULL,
                    specialty_code VARCHAR(20),
                    specialty_name TEXT,
                    labs_total INTEGER,
                    labs_equipped INTEGER,
                    labs_equipped_pct NUMERIC(6,2),
                    score_labs NUMERIC(5,2),
                    zhas_maman_participation VARCHAR(100),
                    score_zhas_maman NUMERIC(5,2),
                    spec_teachers_total INTEGER,
                    spec_teachers_master INTEGER,
                    spec_teachers_master_pct NUMERIC(6,2),
                    score_spec_master NUMERIC(5,2),
                    spec_teachers_science INTEGER,
                    spec_teachers_science_pct NUMERIC(6,2),
                    score_spec_science NUMERIC(5,2),
                    expertise_teachers INTEGER,
                    score_expertise NUMERIC(5,2),
                    ws_expert_republic INTEGER,
                    score_ws_expert_republic NUMERIC(5,2),
                    ws_expert_intl INTEGER,
                    score_ws_expert_intl NUMERIC(5,2),
                    abroad_internship_count INTEGER,
                    abroad_internship_pct NUMERIC(6,2),
                    score_abroad_internship NUMERIC(5,2),
                    prof_contest_winners INTEGER,
                    score_prof_contest NUMERIC(5,2),
                    industry_teachers_count INTEGER,
                    industry_teachers_pct NUMERIC(6,2),
                    score_industry_teachers NUMERIC(5,2),
                    academic_performance_pct NUMERIC(6,2),
                    score_academic NUMERIC(5,2),
                    knowledge_quality_pct NUMERIC(6,2),
                    score_knowledge NUMERIC(5,2),
                    admission_count INTEGER,
                    graduates_count INTEGER,
                    graduates_pct NUMERIC(6,2),
                    score_graduates NUMERIC(5,2),
                    zm_students_count INTEGER,
                    zm_academic_pct NUMERIC(6,2),
                    score_zm_academic NUMERIC(5,2),
                    zm_quality_pct NUMERIC(6,2),
                    score_zm_quality NUMERIC(5,2),
                    zm_admission_count INTEGER,
                    zm_graduates_count INTEGER,
                    zm_graduates_pct NUMERIC(6,2),
                    score_zm_graduates NUMERIC(5,2),
                    ws_student_place_republic VARCHAR(20),
                    score_ws_student_republic NUMERIC(5,2),
                    ws_student_place_intl VARCHAR(20),
                    score_ws_student_intl NUMERIC(5,2),
                    startup_count INTEGER,
                    score_startups NUMERIC(5,2),
                    demo_exam_students INTEGER,
                    score_demo_exam NUMERIC(5,2),
                    entrepreneur_graduates INTEGER,
                    score_entrepreneurs NUMERIC(5,2),
                    employment_graduates INTEGER,
                    employment_employed VARCHAR(50),
                    employment_pct NUMERIC(6,2),
                    score_employment NUMERIC(5,2),
                    zm_employment_graduates INTEGER,
                    zm_employment_employed VARCHAR(50),
                    zm_employment_pct NUMERIC(6,2),
                    score_zm_employment NUMERIC(5,2),
                    dual_students_count INTEGER,
                    score_dual NUMERIC(5,2),
                    employer_request_count INTEGER,
                    score_employer_requests NUMERIC(5,2),
                    specialty_score NUMERIC(6,2),
                    UNIQUE (assessment_id, specialty_raw)
                )
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_cas_assessment ON college_assessment_specialty (assessment_id)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_cas_code ON college_assessment_specialty (specialty_code)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_cas_score ON college_assessment_specialty (specialty_score DESC)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_cas_employment ON college_assessment_specialty (employment_pct)"))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS college_assessment_field_mapping (
                    id SERIAL PRIMARY KEY,
                    ca_column VARCHAR(100) NOT NULL,
                    catalog_field_id INTEGER NOT NULL,
                    UNIQUE (ca_column, catalog_field_id)
                )
            """))
        for region in SEED_REGIONS:
            await conn.execute(
                text("""
                    INSERT INTO regions (id, code, name_ru, type)
                    VALUES (:id, :code, :name_ru, :type)
                    ON CONFLICT (id) DO NOTHING
                """),
                {"id": region[0], "code": region[1], "name_ru": region[2], "type": region[3]},
            )
        for org in SEED_ORGANIZATIONS:
            await conn.execute(
                text("""
                    INSERT INTO organizations (
                        id, bin, name_ru, org_type_id, region_id, ownership_form_id, status
                    )
                    VALUES (:id, :bin, :name_ru, :org_type_id, :region_id, :ownership_form_id, 'active')
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id": db_uuid(org[0]),
                    "bin": org[1],
                    "name_ru": org[2],
                    "org_type_id": org[3],
                    "region_id": org[4],
                    "ownership_form_id": org[5],
                },
            )
        await conn.execute(
            text("""
                INSERT INTO api_tokens (token_hash, org_id, name, scopes, is_active)
                VALUES (:token_hash, :org_id, :name, :scopes, TRUE)
                ON CONFLICT (token_hash) DO UPDATE
                SET org_id = EXCLUDED.org_id,
                    name = EXCLUDED.name,
                    scopes = EXCLUDED.scopes,
                    is_active = TRUE
            """),
            {
                "token_hash": "test_api_key",
                "org_id": db_uuid(DEFAULT_ORG_ID),
                "name": "Local frontend token",
                "scopes": json.dumps(["read", "write", "admin"]) if IS_SQLITE else ["read", "write", "admin"],
            },
        )


@app.on_event("startup")
async def startup_migrate_sqlite() -> None:
    await ensure_local_schema()


async def verify_api_key(
    api_key: str = Security(API_KEY_HEADER),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    key = api_key
    if not key and authorization and authorization.startswith("Bearer "):
        key = authorization.split(" ")[1]

    if not key or key == "mock_access_token_value":
        key = "test_api_key"

    result = await db.execute(
        text("""
            SELECT id, org_id, scopes
            FROM api_tokens
            WHERE token_hash = :h
              AND is_active = TRUE
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        """),
        {"h": key}
    )
    token = result.fetchone()
    if not token:
        result = await db.execute(
            text("SELECT id, org_id, scopes FROM api_tokens WHERE token_hash = 'test_api_key'"),
        )
        token = result.fetchone()

    # Обновить last_used_at
    await db.execute(
        text("UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = :h"),
        {"h": key}
    )
    await db.commit()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid API token")
    return {"token_id": token[0], "org_id": api_id(token[1]), "scopes": token[2]}


# ──────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ──────────────────────────────────────────────

# ── Организации ──
class OrgCreate(BaseModel):
    bin: Optional[str] = Field(None, max_length=12)
    name_ru: str
    org_type_code: str          # 'ДО','ДопО','СО','ТиППО','ВиПО','Общ-е','ГОНС'
    ownership_form_code: Optional[str] = None
    region_id: Optional[int] = None
    locality_id: Optional[int] = None
    address_full: Optional[str] = None
    activity_start_date: Optional[date] = None
    vuz_status: Optional[str] = None
    system_account_id: Optional[str] = None


class OrgOut(BaseModel):
    id: UUID
    bin: Optional[str]
    name_ru: str
    org_type: str
    ownership: Optional[str]
    region: Optional[str]
    address_full: Optional[str]
    status: str
    current_students: Optional[int]

    class Config:
        from_attributes = True


# ── Контингент ──
class ContingentIn(BaseModel):
    org_id: UUID
    snapshot_date: date
    total_count: Optional[int] = None
    new_enrolled: Optional[int] = None
    withdrawn: Optional[int] = None
    bachelor_count: Optional[int] = None
    master_count: Optional[int] = None
    phd_count: Optional[int] = None
    budget_count: Optional[int] = None
    paid_count: Optional[int] = None
    kz_lang_count: Optional[int] = None
    ru_lang_count: Optional[int] = None
    en_lang_count: Optional[int] = None
    many_children_count: Optional[int] = None
    low_income_count: Optional[int] = None
    disabled_count: Optional[int] = None
    orphan_count: Optional[int] = None
    oop_count: Optional[int] = None
    foreign_count: Optional[int] = None
    privileged_share: Optional[float] = None
    absences_count: Optional[int] = None
    by_grade_json: Optional[Dict[str, Any]] = None
    by_specialty_json: Optional[Dict[str, Any]] = None
    prize_winners_json: Optional[Dict[str, Any]] = None


# ── Финансы ──
class FinanceIn(BaseModel):
    org_id: UUID
    period_year: int
    period_month: Optional[int] = None
    annual_budget: Optional[float] = None
    state_order_volume: Optional[float] = None
    extra_budget_income: Optional[float] = None
    per_capita_norm: Optional[float] = None
    expenses_payroll: Optional[float] = None
    expenses_utilities: Optional[float] = None
    expenses_food: Optional[float] = None
    expenses_medical: Optional[float] = None
    expenses_rnd: Optional[float] = None
    expenses_scholarships: Optional[float] = None
    violations_info: Optional[str] = None
    vouchers_issued: Optional[int] = None
    payments_to_suppliers: Optional[float] = None
    funding_sources_json: Optional[Dict[str, Any]] = None


# ── Персонал ──
class StaffIn(BaseModel):
    org_id: UUID
    snapshot_date: date
    total_teachers: Optional[int] = None
    spec_teachers_count: Optional[int] = None
    external_examiners: Optional[int] = None
    avg_workload_hours: Optional[float] = None
    staffing_rate: Optional[float] = None
    teacher_child_ratio: Optional[float] = None
    avg_experience_years: Optional[float] = None
    turnover_rate: Optional[float] = None
    trained_count: Optional[int] = None
    certified_count: Optional[int] = None
    contest_participants: Optional[int] = None
    qualification_json: Optional[Dict[str, Any]] = None
    contest_results_json: Optional[Dict[str, Any]] = None
    staffing_plan_json: Optional[Dict[str, Any]] = None


# ── Инфраструктура ──
class InfraIn(BaseModel):
    org_id: UUID
    snapshot_date: date
    design_capacity: Optional[int] = None
    building_area_sqm: Optional[float] = None
    construction_year: Optional[int] = None
    building_condition_wear_pct: Optional[float] = None
    sanpin_compliance: Optional[bool] = None
    has_library: Optional[bool] = None
    has_canteen: Optional[bool] = None
    has_internet: Optional[bool] = None
    has_shuttle: Optional[bool] = None
    technical_condition: Optional[str] = None
    heating_type: Optional[str] = None
    building_type: Optional[str] = None
    edu_infra_details_json: Optional[Dict[str, Any]] = None
    sports_infra_json: Optional[Dict[str, Any]] = None


# ── ГОНС ──
class GonsSnapshotIn(BaseModel):
    institution_id: int
    snapshot_date: date
    deposits_aquyl_count: Optional[int] = None
    insurance_contracts_count: Optional[int] = None
    deposits_aquyl_total_amount: Optional[float] = None
    insurance_premiums_total: Optional[float] = None
    state_bonus_total: Optional[float] = None
    sok_total: Optional[float] = None


# ── Общежитие ──
class DormResidentIn(BaseModel):
    dormitory_id: UUID
    student_iin: str
    student_org_id: Optional[UUID] = None
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None


# ── Мошенничество ──
class FraudCheckIn(BaseModel):
    org_id: UUID
    check_date: date
    check_type: str
    checked_count: int
    discrepancy_count: int
    discrepancy_details: Optional[Dict[str, Any]] = None


# ──────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────

# ── ОРГАНИЗАЦИИ ──────────────────────────────
@app.get("/api/v1/organizations", tags=["Организации"])
async def list_organizations(
    org_type: Optional[str] = Query(None, description="Тип: ДО,ДопО,СО,ТиППО,ВиПО,Общ-е,ГОНС"),
    region_id: Optional[int] = None,
    status: Optional[str] = Query(None, description="active/reorganized/liquidated"),
    limit: int = Query(50, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    """Список организаций с фильтрацией"""
    conditions = ["1=1"]
    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    if org_type:
        conditions.append("ot.code = :org_type")
        params["org_type"] = org_type
    if region_id:
        conditions.append("o.region_id = :region_id")
        params["region_id"] = region_id
    if status:
        conditions.append("o.status = :status")
        params["status"] = status

    q = f"""
        SELECT o.id, o.bin, o.name_ru, ot.code AS org_type,
               of2.name_ru AS ownership, r.name_ru AS region,
               o.address_full, o.status,
               (SELECT c.total_count FROM contingent_snapshots c
                WHERE c.org_id = o.id ORDER BY c.snapshot_date DESC LIMIT 1) AS current_students
        FROM organizations o
        LEFT JOIN org_types ot ON ot.id = o.org_type_id
        LEFT JOIN ownership_forms of2 ON of2.id = o.ownership_form_id
        LEFT JOIN regions r ON r.id = o.region_id
        WHERE {' AND '.join(conditions)}
        ORDER BY o.name_ru
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(text(q), params)
    rows = result.mappings().all()
    return {"data": [dict(r) for r in rows], "count": len(rows)}


@app.post("/api/v1/organizations", tags=["Организации"], status_code=201)
async def create_organization(
    data: OrgCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    """Создать организацию"""
    # Получить org_type_id
    res = await db.execute(text("SELECT id FROM org_types WHERE code = :c"), {"c": data.org_type_code})
    org_type = res.fetchone()
    if not org_type:
        raise HTTPException(400, f"Тип организации '{data.org_type_code}' не найден")

    ownership_id = None
    if data.ownership_form_code:
        res = await db.execute(text("SELECT id FROM ownership_forms WHERE code = :c"), {"c": data.ownership_form_code})
        own = res.fetchone()
        if own:
            ownership_id = own[0]

    import uuid
    org_id = str(uuid.uuid4())
    result = await db.execute(
        text("""
            INSERT INTO organizations (id, bin, name_ru, org_type_id, ownership_form_id,
                region_id, locality_id, address_full, activity_start_date, vuz_status, system_account_id)
            VALUES (:id, :bin, :name_ru, :org_type_id, :ownership_id,
                :region_id, :locality_id, :address, :start_date, :vuz_status, :sys_id)
            RETURNING id
        """),
        {
            "id": org_id,
            "bin": data.bin, "name_ru": data.name_ru, "org_type_id": org_type[0],
            "ownership_id": ownership_id, "region_id": data.region_id,
            "locality_id": data.locality_id, "address": data.address_full,
            "start_date": data.activity_start_date, "vuz_status": data.vuz_status,
            "sys_id": data.system_account_id
        }
    )
    await db.commit()
    new_id = result.fetchone()[0]
    return {"id": new_id, "message": "Организация создана"}


@app.get("/api/v1/organizations/{org_id}", tags=["Организации"])
async def get_organization(org_id: UUID, db: AsyncSession = Depends(get_db), token: dict = Depends(verify_api_key)):
    """Полные данные организации"""
    res = await db.execute(text("SELECT * FROM vw_org_summary WHERE id = :id"), {"id": str(org_id)})
    row = res.mappings().fetchone()
    if not row:
        raise HTTPException(404, "Организация не найдена")
    return dict(row)


# ── КОНТИНГЕНТ ───────────────────────────────
@app.post("/api/v1/contingent", tags=["Контингент"], status_code=201)
async def upsert_contingent(
    data: ContingentIn,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    """Добавить/обновить снимок контингента"""
    import json
    await db.execute(
        text("""
            INSERT INTO contingent_snapshots
                (org_id, snapshot_date, total_count, new_enrolled, withdrawn,
                 bachelor_count, master_count, phd_count, budget_count, paid_count,
                 kz_lang_count, ru_lang_count, en_lang_count,
                 many_children_count, low_income_count, disabled_count, orphan_count,
                 oop_count, foreign_count, privileged_share, absences_count,
                 by_grade_json, by_specialty_json, prize_winners_json)
            VALUES
                (:org_id, :snapshot_date, :total_count, :new_enrolled, :withdrawn,
                 :bachelor_count, :master_count, :phd_count, :budget_count, :paid_count,
                 :kz_lang_count, :ru_lang_count, :en_lang_count,
                 :many_children_count, :low_income_count, :disabled_count, :orphan_count,
                 :oop_count, :foreign_count, :privileged_share, :absences_count,
                 :by_grade_json, :by_specialty_json, :prize_winners_json)
            ON CONFLICT (org_id, snapshot_date) DO UPDATE SET
                total_count = EXCLUDED.total_count,
                new_enrolled = EXCLUDED.new_enrolled,
                withdrawn = EXCLUDED.withdrawn,
                kz_lang_count = EXCLUDED.kz_lang_count,
                many_children_count = EXCLUDED.many_children_count,
                absences_count = EXCLUDED.absences_count,
                by_grade_json = EXCLUDED.by_grade_json,
                by_specialty_json = EXCLUDED.by_specialty_json
        """),
        {
            **data.model_dump(),
            "org_id": str(data.org_id),
            "by_grade_json": json.dumps(data.by_grade_json) if data.by_grade_json else None,
            "by_specialty_json": json.dumps(data.by_specialty_json) if data.by_specialty_json else None,
            "prize_winners_json": json.dumps(data.prize_winners_json) if data.prize_winners_json else None,
        }
    )
    await db.commit()
    return {"message": "Контингент обновлён"}


@app.get("/api/v1/contingent/{org_id}", tags=["Контингент"])
async def get_contingent(
    org_id: UUID,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    """История контингента организации"""
    conditions = ["org_id = :org_id"]
    params: Dict[str, Any] = {"org_id": str(org_id)}
    if from_date:
        conditions.append("snapshot_date >= :from_date")
        params["from_date"] = from_date
    if to_date:
        conditions.append("snapshot_date <= :to_date")
        params["to_date"] = to_date
    result = await db.execute(
        text(f"SELECT * FROM contingent_snapshots WHERE {' AND '.join(conditions)} ORDER BY snapshot_date DESC"),
        params
    )
    return {"data": [dict(r) for r in result.mappings().all()]}


# ── ФИНАНСЫ ──────────────────────────────────
@app.post("/api/v1/finance", tags=["Финансы"], status_code=201)
async def upsert_finance(
    data: FinanceIn,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    """Добавить/обновить финансовые данные"""
    import json
    funding_sources_sql = "CAST(:funding_sources_json AS jsonb)" if not IS_SQLITE else ":funding_sources_json"
    sqlite_update_flag = ",\n                updated_at_flag = CURRENT_TIMESTAMP" if IS_SQLITE else ""
    await db.execute(
        text(f"""
            INSERT INTO finance_records
                (org_id, period_year, period_month, annual_budget, state_order_volume,
                 extra_budget_income, per_capita_norm, expenses_payroll, expenses_utilities,
                 expenses_food, expenses_medical, expenses_rnd, expenses_scholarships,
                 violations_info, vouchers_issued, payments_to_suppliers, funding_sources_json)
            VALUES
                (:org_id, :period_year, :period_month, :annual_budget, :state_order_volume,
                 :extra_budget_income, :per_capita_norm, :expenses_payroll, :expenses_utilities,
                 :expenses_food, :expenses_medical, :expenses_rnd, :expenses_scholarships,
                 :violations_info, :vouchers_issued, :payments_to_suppliers, {funding_sources_sql})
            ON CONFLICT (org_id, period_year, period_month) DO UPDATE SET
                annual_budget = EXCLUDED.annual_budget,
                expenses_payroll = EXCLUDED.expenses_payroll,
                expenses_utilities = EXCLUDED.expenses_utilities{sqlite_update_flag}
        """),
        {
            **data.model_dump(),
            "org_id": db_uuid(data.org_id),
            "funding_sources_json": json.dumps(data.funding_sources_json) if data.funding_sources_json else None,
        }
    )
    await db.commit()
    return {"message": "Финансовые данные обновлены"}


@app.get("/api/v1/finance/{org_id}", tags=["Финансы"])
async def get_finance(
    org_id: UUID,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    conditions = ["org_id = :org_id"]
    params: Dict[str, Any] = {"org_id": str(org_id)}
    if year:
        conditions.append("period_year = :year")
        params["year"] = year
    result = await db.execute(
        text(f"SELECT * FROM finance_records WHERE {' AND '.join(conditions)} ORDER BY period_year DESC, period_month DESC"),
        params
    )
    return {"data": [dict(r) for r in result.mappings().all()]}


# ── ПЕРСОНАЛ ─────────────────────────────────
@app.post("/api/v1/staff", tags=["Персонал"], status_code=201)
async def upsert_staff(
    data: StaffIn,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    import json
    await db.execute(
        text("""
            INSERT INTO staff_snapshots
                (org_id, snapshot_date, total_teachers, spec_teachers_count,
                 external_examiners, avg_workload_hours, staffing_rate,
                 teacher_child_ratio, avg_experience_years, turnover_rate,
                 trained_count, certified_count, contest_participants,
                 qualification_json, contest_results_json, staffing_plan_json)
            VALUES
                (:org_id, :snapshot_date, :total_teachers, :spec_teachers_count,
                 :external_examiners, :avg_workload_hours, :staffing_rate,
                 :teacher_child_ratio, :avg_experience_years, :turnover_rate,
                 :trained_count, :certified_count, :contest_participants,
                 :qualification_json, :contest_results_json, :staffing_plan_json)
            ON CONFLICT (org_id, snapshot_date) DO UPDATE SET
                total_teachers = EXCLUDED.total_teachers,
                avg_workload_hours = EXCLUDED.avg_workload_hours,
                staffing_rate = EXCLUDED.staffing_rate,
                turnover_rate = EXCLUDED.turnover_rate
        """),
        {
            **data.model_dump(),
            "org_id": str(data.org_id),
            "qualification_json": json.dumps(data.qualification_json) if data.qualification_json else None,
            "contest_results_json": json.dumps(data.contest_results_json) if data.contest_results_json else None,
            "staffing_plan_json": json.dumps(data.staffing_plan_json) if data.staffing_plan_json else None,
        }
    )
    await db.commit()
    return {"message": "Данные о персонале обновлены"}


# ── ИНФРАСТРУКТУРА ────────────────────────────
@app.post("/api/v1/infrastructure", tags=["Инфраструктура"], status_code=201)
async def upsert_infrastructure(
    data: InfraIn,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    import json
    await db.execute(
        text("""
            INSERT INTO infrastructure_records
                (org_id, snapshot_date, design_capacity, building_area_sqm,
                 construction_year, building_condition_wear_pct, sanpin_compliance,
                 has_library, has_canteen, has_internet, has_shuttle,
                 technical_condition, heating_type, building_type,
                 edu_infra_details_json, sports_infra_json)
            VALUES
                (:org_id, :snapshot_date, :design_capacity, :building_area_sqm,
                 :construction_year, :building_condition_wear_pct, :sanpin_compliance,
                 :has_library, :has_canteen, :has_internet, :has_shuttle,
                 :technical_condition, :heating_type, :building_type,
                 :edu_infra_details_json, :sports_infra_json)
            ON CONFLICT (org_id, snapshot_date) DO UPDATE SET
                design_capacity = EXCLUDED.design_capacity,
                technical_condition = EXCLUDED.technical_condition,
                sanpin_compliance = EXCLUDED.sanpin_compliance
        """),
        {
            **data.model_dump(),
            "org_id": str(data.org_id),
            "edu_infra_details_json": json.dumps(data.edu_infra_details_json) if data.edu_infra_details_json else None,
            "sports_infra_json": json.dumps(data.sports_infra_json) if data.sports_infra_json else None,
        }
    )
    await db.commit()
    return {"message": "Инфраструктура обновлена"}


# ── ГОНС ─────────────────────────────────────
@app.post("/api/v1/gons/snapshot", tags=["ГОНС Келешек"], status_code=201)
async def upsert_gons_snapshot(
    data: GonsSnapshotIn,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    await db.execute(
        text("""
            INSERT INTO gons_daily_snapshot
                (institution_id, snapshot_date, deposits_aquyl_count,
                 insurance_contracts_count, deposits_aquyl_total_amount,
                 insurance_premiums_total, state_bonus_total, sok_total)
            VALUES
                (:institution_id, :snapshot_date, :deposits_aquyl_count,
                 :insurance_contracts_count, :deposits_aquyl_total_amount,
                 :insurance_premiums_total, :state_bonus_total, :sok_total)
            ON CONFLICT (institution_id, snapshot_date) DO UPDATE SET
                deposits_aquyl_count = EXCLUDED.deposits_aquyl_count,
                deposits_aquyl_total_amount = EXCLUDED.deposits_aquyl_total_amount,
                state_bonus_total = EXCLUDED.state_bonus_total,
                sok_total = EXCLUDED.sok_total
        """),
        data.model_dump()
    )
    await db.commit()
    return {"message": "Снимок ГОНС сохранён"}


# ── ОБЩЕЖИТИЯ ─────────────────────────────────
@app.post("/api/v1/dormitory/resident", tags=["Общежития"], status_code=201)
async def add_dormitory_resident(
    data: DormResidentIn,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    await db.execute(
        text("""
            INSERT INTO dormitory_residents
                (dormitory_id, student_iin, student_org_id, check_in_date, check_out_date)
            VALUES (:dormitory_id, :student_iin, :student_org_id, :check_in_date, :check_out_date)
        """),
        {
            **data.model_dump(),
            "dormitory_id": str(data.dormitory_id),
            "student_org_id": str(data.student_org_id) if data.student_org_id else None,
        }
    )
    await db.commit()
    return {"message": "Студент-проживающий добавлен"}


@app.get("/api/v1/dormitory/{dormitory_id}/residents", tags=["Общежития"])
async def get_dormitory_residents(
    dormitory_id: UUID,
    is_current: bool = True,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    result = await db.execute(
        text("SELECT * FROM dormitory_residents WHERE dormitory_id = :id AND is_current = :is_current"),
        {"id": str(dormitory_id), "is_current": is_current}
    )
    return {"data": [dict(r) for r in result.mappings().all()]}


# ── АНТИФРОД ─────────────────────────────────
@app.post("/api/v1/fraud-check", tags=["Антифрод"], status_code=201)
async def add_fraud_check(
    data: FraudCheckIn,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    import json
    await db.execute(
        text("""
            INSERT INTO fraud_checks (org_id, check_date, check_type, checked_count,
                                      discrepancy_count, discrepancy_details)
            VALUES (:org_id, :check_date, :check_type, :checked_count,
                    :discrepancy_count, :discrepancy_details)
        """),
        {
            **data.model_dump(),
            "org_id": str(data.org_id),
            "discrepancy_details": json.dumps(data.discrepancy_details) if data.discrepancy_details else None,
        }
    )
    await db.commit()
    return {"message": "Результат проверки сохранён"}


# ── СПРАВОЧНИКИ ───────────────────────────────
@app.get("/api/v1/references/org-types", tags=["Справочники"])
async def get_org_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM org_types ORDER BY id"))
    return {"data": [dict(r) for r in result.mappings().all()]}


@app.get("/api/v1/references/regions", tags=["Справочники"])
async def get_regions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM regions ORDER BY name_ru"))
    return {"data": [dict(r) for r in result.mappings().all()]}


@app.get("/api/v1/references/fields", tags=["Справочники"])
async def get_field_registry(
    org_type: Optional[str] = None,
    section: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Реестр полей — все поля с маппингом по типу организации"""
    conditions = ["1=1"]
    params: Dict[str, Any] = {}
    if org_type:
        conditions.append("org_type_code = :org_type")
        params["org_type"] = org_type
    if section:
        conditions.append("section_code = :section")
        params["section"] = section
    result = await db.execute(
        text(f"SELECT * FROM field_registry WHERE {' AND '.join(conditions)} ORDER BY org_type_code, section_code, field_code"),
        params
    )
    return {"data": [dict(r) for r in result.mappings().all()]}


# ── АНАЛИТИКА ─────────────────────────────────
@app.get("/api/v1/analytics/contingent-summary", tags=["Аналитика"])
async def contingent_summary(
    org_type: Optional[str] = None,
    region_id: Optional[int] = None,
    snapshot_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    """Сводка по контингенту: сумма по регионам/типам"""
    q = """
        SELECT
            ot.code AS org_type,
            r.name_ru AS region,
            COUNT(DISTINCT o.id) AS org_count,
            SUM(c.total_count) AS total_students,
            SUM(c.budget_count) AS budget_students,
            SUM(c.disabled_count) AS disabled_students,
            SUM(c.foreign_count) AS foreign_students
        FROM organizations o
        JOIN org_types ot ON ot.id = o.org_type_id
        LEFT JOIN regions r ON r.id = o.region_id
        LEFT JOIN (
            SELECT cs.* FROM contingent_snapshots cs
            INNER JOIN (
                SELECT org_id, MAX(snapshot_date) AS max_date
                FROM contingent_snapshots
                WHERE (:snapshot_date IS NULL OR snapshot_date <= :snapshot_date)
                GROUP BY org_id
            ) latest ON cs.org_id = latest.org_id AND cs.snapshot_date = latest.max_date
        ) c ON c.org_id = o.id
        WHERE 1=1
          AND (:org_type IS NULL OR ot.code = :org_type)
          AND (:region_id IS NULL OR o.region_id = :region_id)
        GROUP BY ot.code, r.name_ru
        ORDER BY ot.code, r.name_ru
    """
    result = await db.execute(
        text(q),
        {"org_type": org_type, "region_id": region_id, "snapshot_date": snapshot_date}
    )
    return {"data": [dict(r) for r in result.mappings().all()]}


# ── HEALTH CHECK ──────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat()}


# ── MOCK AUTH ENDPOINTS FOR FRONTEND ──────────
MOCK_USER = {
    "id": "11000000-0000-0000-0000-000000000002",
    "email": "knursagitov@gmail.com",
    "full_name": "Канип Нурсагитов",
    "role": "admin",
    "org_id": "11000000-0000-0000-0000-000000000001",
    "must_change_password": False
}

@app.post("/api/v1/auth/login")
async def mock_login(request: Request, response: Response):
    body = await request.json()
    email = body.get("email", "").lower().strip()
    password = body.get("password", "")

    response.set_cookie(
        key="refresh_token",
        value="mock_refresh_token_value",
        httponly=True,
        samesite="strict",
        path="/api/v1/auth"
    )

    return {
        "access_token": "mock_access_token_value",
        "token_type": "Bearer",
        "expires_in": 3600,
        "user": MOCK_USER
    }

@app.post("/api/v1/auth/refresh")
async def mock_refresh(response: Response):
    response.set_cookie(
        key="refresh_token",
        value="mock_refresh_token_value",
        httponly=True,
        samesite="strict",
        path="/api/v1/auth"
    )
    return {
        "access_token": "mock_access_token_value",
        "token_type": "Bearer",
        "expires_in": 3600
    }

@app.get("/api/v1/auth/me")
async def mock_me():
    return MOCK_USER

@app.post("/api/v1/auth/logout")
async def mock_logout(response: Response):
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth",
        httponly=True,
        samesite="strict"
    )
    return {"message": "Успешный выход"}


# ── MOCK ADMIN ENDPOINTS FOR DASHBOARD ──────────
@app.post("/api/v1/auth/change-password")
async def change_password(_body: Dict[str, Any]):
    return {"message": "password_changed"}


@app.post("/api/v1/auth/register")
async def register_user(body: Dict[str, Any]):
    return {
        "id": body.get("id") or "11000000-0000-0000-0000-000000000099",
        "email": body.get("email"),
        "full_name": body.get("full_name") or body.get("email"),
        "role": body.get("role") or "data_entry",
        "org_id": body.get("org_id"),
        "must_change_password": False,
    }


DOMAIN_ALIASES = {
    "science": "science-activity",
    "science-activity": "science-activity",
    "contingent": "contingent",
    "finance": "finance",
    "graduates": "graduates",
    "education": "education",
    "school-rating": "school-rating",
}

DOMAIN_TABLE_LABELS = {
    "contingent": "Contingent",
    "finance": "Finance",
    "science-activity": "Science",
    "graduates": "Graduates",
    "education": "Education",
    "school-rating": "School rating",
}


def normalize_domain(domain: str) -> str:
    normalized = DOMAIN_ALIASES.get(domain)
    if not normalized:
        raise HTTPException(status_code=404, detail=f"Unknown form domain: {domain}")
    return normalized


async def resolve_org_id(org_id: str, db: AsyncSession, token: Optional[dict] = None) -> str:
    if org_id != "my":
        return org_id
    if token and token.get("org_id"):
        return str(token["org_id"])
    result = await db.execute(text("SELECT org_id FROM api_tokens WHERE token_hash = 'test_api_key'"))
    value = result.scalar()
    if not value:
        raise HTTPException(status_code=404, detail="Default organisation is not configured")
    return str(value)


def extract_record_period(payload: Dict[str, Any]) -> Dict[str, Any]:
    snapshot_date = payload.get("snapshot_date") or None
    period_year = int_or_none(payload.get("period_year"))
    academic_year = int_or_none(payload.get("academic_year"))
    if period_year is None and academic_year is not None:
        period_year = academic_year
    if period_year is None and snapshot_date:
        try:
            period_year = int(str(snapshot_date)[:4])
        except ValueError:
            period_year = None
    return {
        "period_year": period_year,
        "period_month": int_or_none(payload.get("period_month")),
        "period_quarter": int_or_none(payload.get("period_quarter")),
        "snapshot_date": snapshot_date,
        "academic_year": academic_year,
    }


def record_to_response(row: Any) -> Dict[str, Any]:
    payload = decode_payload(row["payload_json"])
    response = dict(payload)
    response.update(
        {
            "id": row["id"],
            "org_id": api_id(row["org_id"]),
            "domain": row["domain"],
            "period_year": row["period_year"] or payload.get("period_year") or payload.get("academic_year"),
            "period_month": row["period_month"],
            "period_quarter": row["period_quarter"],
            "snapshot_date": jsonable(row["snapshot_date"]) or payload.get("snapshot_date"),
            "academic_year": row["academic_year"] or payload.get("academic_year"),
            "submission_status": row["submission_status"],
            "submitted_at": jsonable(row["submitted_at"]),
            "created_at": jsonable(row["created_at"]),
            "updated_at": jsonable(row["updated_at"]),
        }
    )
    return response


async def get_form_record(db: AsyncSession, org_id: str, domain: str, record_id: int) -> Dict[str, Any]:
    result = await db.execute(
        text("""
            SELECT *
            FROM form_records
            WHERE id = :id AND org_id = :org_id AND domain = :domain
        """),
        {"id": record_id, "org_id": db_uuid(org_id), "domain": domain},
    )
    row = result.mappings().fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    return record_to_response(row)


@app.get("/api/v1/organisations/{org_id}/{domain}")
async def list_org_domain_records(
    org_id: str,
    domain: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    resolved_org_id = await resolve_org_id(org_id, db, token)
    normalized_domain = normalize_domain(domain)
    result = await db.execute(
        text("""
            SELECT *
            FROM form_records
            WHERE org_id = :org_id AND domain = :domain
            ORDER BY COALESCE(period_year, academic_year, 0) DESC, updated_at DESC, id DESC
            LIMIT :limit OFFSET :offset
        """),
        {
            "org_id": db_uuid(resolved_org_id),
            "domain": normalized_domain,
            "limit": limit,
            "offset": offset,
        },
    )
    rows = [record_to_response(r) for r in result.mappings().all()]
    count_result = await db.execute(
        text("SELECT COUNT(*) FROM form_records WHERE org_id = :org_id AND domain = :domain"),
        {"org_id": db_uuid(resolved_org_id), "domain": normalized_domain},
    )
    return {"items": rows, "total": count_result.scalar() or 0, "limit": limit, "offset": offset}


@app.post("/api/v1/organisations/{org_id}/{domain}", status_code=201)
async def create_org_domain_record(
    org_id: str,
    domain: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    resolved_org_id = await resolve_org_id(org_id, db, token)
    normalized_domain = normalize_domain(domain)
    payload = dict(body)
    status_value = payload.get("submission_status") or "draft"
    period = extract_record_period(payload)
    payload_sql = "CAST(:payload_json AS jsonb)" if not IS_SQLITE else ":payload_json"
    returning_sql = "" if IS_SQLITE else "RETURNING id"
    result = await db.execute(
        text(f"""
            INSERT INTO form_records (
                org_id, domain, period_year, period_month, period_quarter,
                snapshot_date, academic_year, payload_json, submission_status,
                submitted_at, created_at, updated_at
            )
            VALUES (
                :org_id, :domain, :period_year, :period_month, :period_quarter,
                :snapshot_date, :academic_year, {payload_sql}, :submission_status,
                CASE WHEN :submission_status = 'submitted' THEN CURRENT_TIMESTAMP ELSE NULL END,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            {returning_sql}
        """),
        {
            "org_id": db_uuid(resolved_org_id),
            "domain": normalized_domain,
            "payload_json": json.dumps(payload, ensure_ascii=False, default=str),
            "submission_status": status_value,
            **period,
        },
    )
    if IS_SQLITE:
        id_result = await db.execute(text("SELECT last_insert_rowid()"))
        record_id = id_result.scalar()
    else:
        record_id = result.scalar_one()
    await db.commit()
    return await get_form_record(db, resolved_org_id, normalized_domain, record_id)


@app.get("/api/v1/organisations/{org_id}/{domain}/{record_id}")
async def get_org_domain_record(
    org_id: str,
    domain: str,
    record_id: int,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    resolved_org_id = await resolve_org_id(org_id, db, token)
    normalized_domain = normalize_domain(domain)
    return await get_form_record(db, resolved_org_id, normalized_domain, record_id)


@app.patch("/api/v1/organisations/{org_id}/{domain}/{record_id}")
async def update_org_domain_record(
    org_id: str,
    domain: str,
    record_id: int,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    resolved_org_id = await resolve_org_id(org_id, db, token)
    normalized_domain = normalize_domain(domain)
    current = await get_form_record(db, resolved_org_id, normalized_domain, record_id)
    payload = {
        k: v for k, v in current.items()
        if k not in {"id", "org_id", "domain", "submission_status", "submitted_at", "created_at", "updated_at"}
    }
    payload.update(body)
    status_value = body.get("submission_status") or current.get("submission_status") or "draft"
    period = extract_record_period(payload)
    payload_sql = "CAST(:payload_json AS jsonb)" if not IS_SQLITE else ":payload_json"
    await db.execute(
        text(f"""
            UPDATE form_records
            SET period_year = :period_year,
                period_month = :period_month,
                period_quarter = :period_quarter,
                snapshot_date = :snapshot_date,
                academic_year = :academic_year,
                payload_json = {payload_sql},
                submission_status = :submission_status,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id AND org_id = :org_id AND domain = :domain
        """),
        {
            "id": record_id,
            "org_id": db_uuid(resolved_org_id),
            "domain": normalized_domain,
            "payload_json": json.dumps(payload, ensure_ascii=False, default=str),
            "submission_status": status_value,
            **period,
        },
    )
    await db.commit()
    return await get_form_record(db, resolved_org_id, normalized_domain, record_id)


@app.patch("/api/v1/organisations/{org_id}/{domain}/{record_id}/status")
async def update_org_domain_status(
    org_id: str,
    domain: str,
    record_id: int,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    resolved_org_id = await resolve_org_id(org_id, db, token)
    normalized_domain = normalize_domain(domain)
    new_status = body.get("new_status") or body.get("status")
    if new_status not in {"draft", "submitted", "under_review", "approved", "rejected"}:
        raise HTTPException(status_code=422, detail="Invalid status")
    await get_form_record(db, resolved_org_id, normalized_domain, record_id)
    await db.execute(
        text("""
            UPDATE form_records
            SET submission_status = :status,
                submitted_at = CASE
                    WHEN :status = 'submitted' AND submitted_at IS NULL THEN CURRENT_TIMESTAMP
                    ELSE submitted_at
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id AND org_id = :org_id AND domain = :domain
        """),
        {"id": record_id, "org_id": db_uuid(resolved_org_id), "domain": normalized_domain, "status": new_status},
    )
    await db.commit()
    return await get_form_record(db, resolved_org_id, normalized_domain, record_id)


@app.get("/api/v1/admin/references/regions")
async def get_admin_reference_regions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT id, code, name_ru, type FROM regions ORDER BY name_ru"))
    return [dict(r) for r in result.mappings().all()]


@app.get("/api/v1/admin/references/org-types")
async def get_admin_reference_org_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT id, code, name_ru FROM org_types ORDER BY id"))
    return [dict(r) for r in result.mappings().all()]


@app.get("/api/v1/admin/users")
async def get_admin_users():
    return [{**MOCK_USER, "is_active": True}]


@app.get("/api/v1/admin/audit-logs")
async def get_admin_audit_logs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, method, path, user_email, created_at
            FROM audit_logs
            ORDER BY created_at DESC, id DESC
            LIMIT 100
        """)
    )
    rows = [dict(r) for r in result.mappings().all()]
    if rows:
        return rows
    return [
        {
            "id": 1,
            "method": "GET",
            "path": "/api/v1/auth/me",
            "user_email": MOCK_USER["email"],
            "created_at": datetime.utcnow().isoformat(),
        }
    ]


@app.get("/api/v1/admin/superset/guest-token/{dashboard_id}")
async def mock_superset_guest_token(dashboard_id: int):
    return {
        "token": f"local-dev-guest-token-{dashboard_id}",
        "embedded_uuid": f"local-dashboard-{dashboard_id}",
    }


@app.get("/api/v1/admin/pending-submissions")
async def pending_submissions_from_db(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT fr.id AS record_id, fr.domain, fr.org_id, o.name_ru AS org_name,
                   fr.period_year, fr.snapshot_date, fr.academic_year,
                   fr.submission_status, fr.submitted_at, fr.updated_at
            FROM form_records fr
            LEFT JOIN organizations o ON o.id = fr.org_id
            WHERE fr.submission_status IN ('submitted', 'under_review')
            ORDER BY COALESCE(fr.submitted_at, fr.updated_at) DESC, fr.id DESC
            LIMIT 100
        """)
    )
    items = []
    for row in result.mappings().all():
        domain = row["domain"]
        period = row["period_year"] or row["academic_year"] or row["snapshot_date"] or "-"
        items.append({
            "record_id": row["record_id"],
            "table_name": domain,
            "table_label": DOMAIN_TABLE_LABELS.get(domain, domain),
            "org_id": row["org_id"],
            "org_name": row["org_name"] or row["org_id"],
            "period": str(period),
            "status": row["submission_status"],
            "submitted_at": row["submitted_at"] or row["updated_at"],
            "submitted_by": MOCK_USER["email"],
        })
    return {"items": items, "total": len(items)}


@app.get("/api/v1/admin/pending-submissions")
async def mock_pending_submissions():
    return {
        "items": [
            {
                "record_id": 1,
                "table_name": "finance_records",
                "table_label": "Финансы",
                "org_id": "11000000-0000-0000-0000-000000000001",
                "org_name": "КазНУ им. аль-Фараби",
                "period": "Апрель 2026",
                "status": "submitted",
                "submitted_at": "2026-06-15T09:00:00Z",
                "submitted_by": "operator@kaznu.edu.kz"
            }
        ],
        "total": 1
    }

@app.get("/api/v1/admin/superset/dashboards")
async def mock_superset_dashboards():
    return {
        "result": [
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
            }
        ]
    }

@app.get("/api/v1/admin/stats")
async def admin_stats_from_db(db: AsyncSession = Depends(get_db)):
    org_count = (await db.execute(text("SELECT COUNT(*) FROM organizations"))).scalar() or 0
    legacy_students = (await db.execute(text("SELECT COALESCE(SUM(total_count), 0) FROM contingent_snapshots"))).scalar() or 0
    form_rows = await db.execute(
        text("SELECT domain, payload_json, submission_status FROM form_records")
    )
    total_students = int(legacy_students or 0)
    pending_science = 0
    pending_contingent = 0
    for row in form_rows.mappings().all():
        payload = decode_payload(row["payload_json"])
        if row["domain"] == "contingent":
            total_students += int(payload.get("total_count") or 0)
            if row["submission_status"] in {"submitted", "under_review"}:
                pending_contingent += 1
        if row["domain"] == "science-activity" and row["submission_status"] in {"submitted", "under_review"}:
            pending_science += 1
    return {
        "organizations": org_count,
        "total_students": total_students,
        "pending_science": pending_science,
        "pending_contingent": pending_contingent,
        "redis_version": "local",
        "uptime_seconds": 0,
    }


@app.get("/api/v1/admin/stats")
async def mock_admin_stats(db: AsyncSession = Depends(get_db)):
    res_org = await db.execute(text("SELECT COUNT(*) FROM organizations"))
    org_count = res_org.scalar() or 0

    res_stud = await db.execute(text("SELECT SUM(total_count) FROM contingent_snapshots"))
    stud_count = res_stud.scalar() or 0

    return {
        "organizations": org_count,
        "total_students": stud_count,
        "pending_science": 0,
        "pending_contingent": 1,
        "redis_version": "7.0.0",
        "uptime_seconds": 3600
    }


# ── NEW MOCK ENDPOINTS FOR OVERVIEW & RATINGS ──
ORG_TYPE_LEVEL = {1: "do", 2: "dopo", 3: "so", 4: "tippo", 5: "vipo"}


@app.get("/api/v1/admin/overview-stats")
async def overview_stats_from_db(db: AsyncSession = Depends(get_db)):
    levels = {
        "do": {"org_count": 0, "budget_mlrd": 0.0},
        "so": {"org_count": 0, "budget_mlrd": 0.0},
        "tippo": {"org_count": 0, "budget_mlrd": 0.0},
        "vipo": {"org_count": 0, "budget_mlrd": 0.0},
        "dopo": {"org_count": 0, "budget_mlrd": 0.0},
    }
    org_rows = await db.execute(
        text("""
            SELECT id, org_type_id
            FROM organizations
            WHERE COALESCE(status, 'active') = 'active'
        """)
    )
    org_to_level = {}
    for row in org_rows.mappings().all():
        level = ORG_TYPE_LEVEL.get(row["org_type_id"])
        if not level:
            continue
        org_to_level[row["id"]] = level
        levels[level]["org_count"] += 1

    finance_rows = await db.execute(
        text("SELECT org_id, payload_json FROM form_records WHERE domain = 'finance'")
    )
    budgets = {key: 0.0 for key in levels}
    for row in finance_rows.mappings().all():
        level = org_to_level.get(row["org_id"])
        if not level:
            continue
        payload = decode_payload(row["payload_json"])
        amount = (
            payload.get("total_income")
            or payload.get("budget_total")
            or payload.get("annual_budget")
            or 0
        )
        budgets[level] += float(amount or 0)

    legacy_rows = await db.execute(
        text("""
            SELECT o.org_type_id, COALESCE(SUM(f.annual_budget), 0) AS total_budget
            FROM finance_records f
            JOIN organizations o ON o.id = f.org_id
            GROUP BY o.org_type_id
        """)
    )
    for row in legacy_rows.mappings().all():
        level = ORG_TYPE_LEVEL.get(row["org_type_id"])
        if level:
            budgets[level] += float(row["total_budget"] or 0)

    for level, budget in budgets.items():
        levels[level]["budget_mlrd"] = round(budget / 1_000_000_000, 1)
    return {"levels": levels}


@app.get("/api/v1/admin/overview-stats")
async def get_overview_stats():
    return {
        "levels": {
            "do": { "org_count": 120, "budget_mlrd": 45.5 },
            "so": { "org_count": 350, "budget_mlrd": 128.2 },
            "tippo": { "org_count": 23, "budget_mlrd": 12.8 },
            "vipo": { "org_count": 15, "budget_mlrd": 88.4 },
            "dopo": { "org_count": 45, "budget_mlrd": 8.1 }
        }
    }

@app.get("/api/v1/admin/organisations")
async def admin_organisations_from_db(
    limit: int = 500,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    q = """
        SELECT o.id, o.bin, o.bin AS bin_iin, o.name_ru,
               o.org_type_id, o.region_id, o.ownership_form_id,
               ot.code AS org_type,
               of2.name_ru AS ownership, r.name_ru AS region,
               o.address_full, o.status,
               (
                   SELECT c.total_count
                   FROM contingent_snapshots c
                   WHERE c.org_id = o.id
                   ORDER BY c.snapshot_date DESC
                   LIMIT 1
               ) AS legacy_students
        FROM organizations o
        LEFT JOIN org_types ot ON ot.id = o.org_type_id
        LEFT JOIN ownership_forms of2 ON of2.id = o.ownership_form_id
        LEFT JOIN regions r ON r.id = o.region_id
        ORDER BY o.name_ru
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(text(q), {"limit": limit, "offset": offset})
    rows = [dict(r) for r in result.mappings().all()]
    for item in rows:
        item["id"] = str(item["id"])
        item["current_students"] = item.pop("legacy_students") or 0
    total = (await db.execute(text("SELECT COUNT(*) FROM organizations"))).scalar() or len(rows)
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@app.get("/api/v1/admin/organisations")
async def get_admin_organisations(
    limit: int = 500,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    q = """
        SELECT o.id, o.bin, o.name_ru, ot.code AS org_type,
               of2.name_ru AS ownership, r.name_ru AS region,
               o.address_full, o.status,
               (SELECT c.total_count FROM contingent_snapshots c
                WHERE c.org_id = o.id ORDER BY c.snapshot_date DESC LIMIT 1) AS current_students
        FROM organizations o
        LEFT JOIN org_types ot ON ot.id = o.org_type_id
        LEFT JOIN ownership_forms of2 ON of2.id = o.ownership_form_id
        LEFT JOIN regions r ON r.id = o.region_id
        ORDER BY o.name_ru
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(text(q), {"limit": limit, "offset": offset})
    rows = result.mappings().all()
    items = [dict(r) for r in rows]
    for item in items:
        item["id"] = str(item["id"])
    return {"items": items, "total": len(items)}

@app.post("/api/v1/college-assessment/import")
async def import_college_assessment(
    file: UploadFile = File(...),
    period_year: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    filename = file.filename or ""
    if not filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=422, detail="Поддерживаются только .xlsx / .xls")

    contents = await file.read()
    try:
        result = await parse_and_import_college_assessment(
            db,
            contents,
            filename,
            period_year,
            None,
        )
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail=f"Не удалось импортировать файл: {exc}") from exc

    return {"filename": filename, **result}


@app.get("/api/v1/college-assessment/ratings")
async def get_college_ratings(
    period_year: Optional[int] = Query(None),
    region: Optional[str] = Query(None),
    ownership: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    where: List[str] = ["1=1"]
    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    if period_year:
        where.append("ca.period_year = :year")
        params["year"] = period_year
    if region:
        where.append("LOWER(ca.region) LIKE LOWER(:region)")
        params["region"] = f"%{region}%"
    if ownership:
        where.append("LOWER(ca.ownership_form) LIKE LOWER(:ownership)")
        params["ownership"] = f"%{ownership}%"
    where_sql = " AND ".join(where)
    result = await db.execute(
        text(f"""
            SELECT
                ca.id, ca.college_name, ca.region, ca.district,
                ca.ownership_form, ca.location_type, ca.period_year,
                ca.contingent_actual, ca.capacity_design, ca.teachers_total,
                ca.total_score,
                COUNT(cas.id) AS specialty_count,
                ROUND(AVG(cas.specialty_score), 2) AS avg_specialty_score,
                RANK() OVER (PARTITION BY ca.period_year ORDER BY ca.total_score DESC NULLS LAST) AS rank
            FROM college_assessment ca
            LEFT JOIN college_assessment_specialty cas ON cas.assessment_id = ca.id
            WHERE {where_sql}
            GROUP BY ca.id
            ORDER BY ca.total_score DESC NULLS LAST, ca.college_name
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM college_assessment ca WHERE {where_sql}"),
        {k: v for k, v in params.items() if k not in {"limit", "offset"}},
    )
    return {"items": [dict(r) for r in result.mappings().all()], "total": count_result.scalar() or 0}


@app.get("/api/v1/college-assessment/stats/overview")
async def get_college_stats_overview(
    period_year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    where = "WHERE period_year = :year" if period_year else ""
    params = {"year": period_year} if period_year else {}
    result = await db.execute(
        text(f"""
            SELECT
                region,
                COUNT(*) AS college_count,
                ROUND(AVG(total_score), 2) AS avg_score,
                MAX(total_score) AS max_score,
                MIN(total_score) AS min_score,
                SUM(contingent_actual) AS total_students,
                COUNT(CASE WHEN total_score >= 20 THEN 1 END) AS high_performers,
                COUNT(CASE WHEN total_score < 10 THEN 1 END) AS low_performers
            FROM college_assessment
            {where}
            GROUP BY region
            ORDER BY avg_score DESC NULLS LAST
        """),
        params,
    )
    return {"by_region": [dict(r) for r in result.mappings().all()]}


@app.get("/api/v1/college-assessment/top-specialties/employment")
async def get_college_top_specialties(
    period_year: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    year_filter = "AND ca.period_year = :year" if period_year else ""
    params: Dict[str, Any] = {"limit": limit}
    if period_year:
        params["year"] = period_year
    result = await db.execute(
        text(f"""
            SELECT
                cas.specialty_name, cas.specialty_code,
                ca.college_name, ca.region,
                cas.employment_pct, cas.specialty_score,
                cas.dual_students_count, cas.demo_exam_students
            FROM college_assessment_specialty cas
            JOIN college_assessment ca ON ca.id = cas.assessment_id
            WHERE cas.employment_pct IS NOT NULL {year_filter}
            ORDER BY cas.employment_pct DESC NULLS LAST
            LIMIT :limit
        """),
        params,
    )
    return {"items": [dict(r) for r in result.mappings().all()]}


@app.get("/api/v1/college-assessment/{assessment_id}/specialties")
async def get_college_specialties(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(verify_api_key),
):
    result = await db.execute(
        text("""
            SELECT specialty_code, specialty_name, specialty_score,
                   employment_pct, academic_performance_pct,
                   score_employment, score_academic, score_dual,
                   dual_students_count, demo_exam_students,
                   ws_student_place_republic, ws_student_place_intl
            FROM college_assessment_specialty
            WHERE assessment_id = :id
            ORDER BY specialty_score DESC NULLS LAST
        """),
        {"id": assessment_id},
    )
    return {"specialties": [dict(r) for r in result.mappings().all()]}
