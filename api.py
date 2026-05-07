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

import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@localhost:5432/edu_monitoring"
)

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


# ──────────────────────────────────────────────
# DEPENDENCIES
# ──────────────────────────────────────────────
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def verify_api_key(api_key: str = Security(API_KEY_HEADER), db: AsyncSession = Depends(get_db)):
    if not api_key:
        raise HTTPException(status_code=401, detail="API ключ обязателен")
    result = await db.execute(
        text("SELECT id, org_id, scopes FROM api_tokens WHERE token_hash = :h AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())"),
        {"h": api_key}
    )
    token = result.fetchone()
    if not token:
        raise HTTPException(status_code=403, detail="Недействительный API ключ")
    # Обновить last_used_at
    await db.execute(
        text("UPDATE api_tokens SET last_used_at = NOW() WHERE token_hash = :h"),
        {"h": api_key}
    )
    await db.commit()
    return {"token_id": token[0], "org_id": token[1], "scopes": token[2]}


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

    result = await db.execute(
        text("""
            INSERT INTO organizations (bin, name_ru, org_type_id, ownership_form_id,
                region_id, locality_id, address_full, activity_start_date, vuz_status, system_account_id)
            VALUES (:bin, :name_ru, :org_type_id, :ownership_id,
                :region_id, :locality_id, :address, :start_date, :vuz_status, :sys_id)
            RETURNING id
        """),
        {
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
    res = await db.execute(text("SELECT * FROM vw_org_summary WHERE id = :id"), {"id": org_id})
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
    params: Dict[str, Any] = {"org_id": org_id}
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
    await db.execute(
        text("""
            INSERT INTO finance_records
                (org_id, period_year, period_month, annual_budget, state_order_volume,
                 extra_budget_income, per_capita_norm, expenses_payroll, expenses_utilities,
                 expenses_food, expenses_medical, expenses_rnd, expenses_scholarships,
                 violations_info, vouchers_issued, payments_to_suppliers, funding_sources_json)
            VALUES
                (:org_id, :period_year, :period_month, :annual_budget, :state_order_volume,
                 :extra_budget_income, :per_capita_norm, :expenses_payroll, :expenses_utilities,
                 :expenses_food, :expenses_medical, :expenses_rnd, :expenses_scholarships,
                 :violations_info, :vouchers_issued, :payments_to_suppliers, :funding_sources_json)
            ON CONFLICT (org_id, period_year, period_month) DO UPDATE SET
                annual_budget = EXCLUDED.annual_budget,
                expenses_payroll = EXCLUDED.expenses_payroll,
                expenses_utilities = EXCLUDED.expenses_utilities,
                updated_at_flag = NOW()
        """),
        {
            **data.model_dump(),
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
    params: Dict[str, Any] = {"org_id": org_id}
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
        data.model_dump()
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
        {"id": dormitory_id, "is_current": is_current}
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
        LEFT JOIN LATERAL (
            SELECT * FROM contingent_snapshots cs
            WHERE cs.org_id = o.id
              AND (:snapshot_date::date IS NULL OR cs.snapshot_date <= :snapshot_date::date)
            ORDER BY cs.snapshot_date DESC LIMIT 1
        ) c ON TRUE
        WHERE 1=1
          AND (:org_type::text IS NULL OR ot.code = :org_type)
          AND (:region_id::int IS NULL OR o.region_id = :region_id)
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
