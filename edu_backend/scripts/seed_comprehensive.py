"""
scripts/seed_comprehensive.py
─────────────────────────────────────────────────────────────────────────────
Генерирует реалистичные данные за 2020-2025 для всех 12 организаций
по 5 таблицам: contingent_snapshots, finance_records, science_activity,
graduates_records, educational_process.

Запуск:
    docker compose exec api python -m scripts.seed_comprehensive
"""
from __future__ import annotations

import asyncio
import random
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncWriteSession, init_db

# ─────────────────────────────────────────────────────────────────────────────
# Конфигурация
# ─────────────────────────────────────────────────────────────────────────────

SUPERADMIN_ID = UUID("5222215e-4fa6-4f9b-b3d2-8d783e5993da")
SOURCE_ID = 1
YEARS = list(range(2020, 2026))  # 2020..2025

# Организации: id → (name, профиль размера)
ORGS = {
    UUID("11000000-0000-0000-0000-000000000001"): ("КазНУ им. аль-Фараби",      "large"),
    UUID("11000000-0000-0000-0000-000000000002"): ("ЕНУ им. Л.Н. Гумилёва",     "large"),
    UUID("11000000-0000-0000-0000-000000000003"): ("КазНТУ им. К.И. Сатпаева",  "large"),
    UUID("11000000-0000-0000-0000-000000000004"): ("Назарбаев Университет",      "elite"),
    UUID("11000000-0000-0000-0000-000000000005"): ("КазГЮУ им. М.С. Нарикбаева","medium"),
    UUID("11000000-0000-0000-0000-000000000006"): ("КБТУ",                       "medium"),
    UUID("11000000-0000-0000-0000-000000000007"): ("КарТУ",                      "medium"),
    UUID("11000000-0000-0000-0000-000000000008"): ("Торайгыров Университет",     "medium"),
    UUID("11000000-0000-0000-0000-000000000009"): ("ЗКТУ им. М. Утемисова",      "small"),
    UUID("11000000-0000-0000-0000-000000000010"): ("Атырауский Университет",     "small"),
    UUID("11000000-0000-0000-0000-000000000011"): ("ЮКУ им. М. Ауэзова",         "small"),
    UUID("11000000-0000-0000-0000-000000000012"): ("Almaty Management University","small"),
}

SIZE_PARAMS = {
    "elite":  {"students": (8000, 12000),  "budget_m": (20000, 35000),  "hirsch": (12, 20)},
    "large":  {"students": (15000, 25000), "budget_m": (8000,  15000),  "hirsch": (6, 12)},
    "medium": {"students": (5000,  12000), "budget_m": (3000,  8000),   "hirsch": (4, 8)},
    "small":  {"students": (2000,  6000),  "budget_m": (1500,  4000),   "hirsch": (2, 6)},
}

DIRECTIONS = ["Информатика и ИКТ", "Педагогика", "Право", "Экономика",
              "Инженерия", "Медицина", "Естественные науки", "Социология"]

SPECIALTIES = ["6B061", "6B072", "6B041", "6B042", "6B031", "6B051",
               "7M061", "7M072", "8D061", "6B011", "6B012"]


def rnd(lo: float, hi: float, *, digits: int = 2) -> Decimal:
    return round(Decimal(str(random.uniform(lo, hi))), digits)


def rint(lo: int, hi: int) -> int:
    return random.randint(lo, hi)


# ─────────────────────────────────────────────────────────────────────────────
# Генераторы данных по таблицам
# ─────────────────────────────────────────────────────────────────────────────

def make_contingent(org_id: UUID, year: int, profile: str) -> dict:
    p = SIZE_PARAMS[profile]
    total = rint(*p["students"])
    # Ежегодный рост ~3-5%
    growth_factor = 1 + (year - 2020) * random.uniform(0.02, 0.05)
    total = int(total * min(growth_factor, 1.3))
    budget = int(total * random.uniform(0.55, 0.75))
    paid = total - budget
    foreign = int(total * random.uniform(0.02, 0.08))
    full_time = int(total * random.uniform(0.70, 0.85))
    distance = total - full_time
    bachelor = int(total * random.uniform(0.70, 0.80))
    master = int(total * random.uniform(0.12, 0.18))
    phd = total - bachelor - master
    kz = int(total * random.uniform(0.60, 0.75))
    ru = int(total * random.uniform(0.20, 0.35))
    en_lang = int(total * random.uniform(0.03, 0.10))
    other = total - kz - ru - en_lang
    privileged_total = int(total * random.uniform(0.08, 0.15))
    new_enrolled = int(total * random.uniform(0.20, 0.28))
    withdrawn = int(total * random.uniform(0.03, 0.08))

    by_grade = {str(i): rint(int(total * 0.1), int(total * 0.35)) for i in range(1, 5)}
    by_specialty = {s: rint(50, 500) for s in random.sample(SPECIALTIES, k=6)}
    prize_winners = [
        {"name": f"Студент {i}", "award": random.choice(["золото", "серебро", "бронза"]),
         "competition": random.choice(["Олимпиада по физике", "Хакатон", "Конкурс НИРС"])}
        for i in range(rint(2, 8))
    ]

    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        total_count=total, new_enrolled=new_enrolled, withdrawn=withdrawn,
        bachelor_count=bachelor, master_count=master, phd_count=max(0, phd),
        full_time_count=full_time, distance_count=distance,
        budget_count=budget, paid_count=paid,
        kz_lang_count=kz, ru_lang_count=ru, en_lang_count=en_lang,
        other_lang_count=max(0, other),
        foreign_count=foreign,
        many_children_count=int(privileged_total * 0.35),
        low_income_count=int(privileged_total * 0.30),
        disabled_count=int(privileged_total * 0.10),
        orphan_count=int(privileged_total * 0.08),
        oop_count=int(privileged_total * 0.17),
        privileged_share=rnd(8.0, 15.0),
        boarding_school_count=rint(0, 200) if profile in ("large", "elite") else rint(0, 50),
        absences_count=rint(50, 500),
        by_grade_json=by_grade,
        by_specialty_json=by_specialty,
        prize_winners_json=prize_winners,
        submission_status="approved",
        created_by=SUPERADMIN_ID, updated_by=SUPERADMIN_ID,
        created_at=datetime(year, 12, 31, 12, 0, tzinfo=timezone.utc),
        updated_at=datetime(year, 12, 31, 14, 0, tzinfo=timezone.utc),
    )


def make_finance(org_id: UUID, year: int, profile: str) -> dict:
    p = SIZE_PARAMS[profile]
    budget_m = rint(*p["budget_m"])  # млн тенге
    annual_budget = Decimal(budget_m) * Decimal("1000000")
    state_order = annual_budget * rnd(0.40, 0.65)
    extra_income = annual_budget * rnd(0.15, 0.30)

    payroll = annual_budget * rnd(0.35, 0.50)
    utilities = annual_budget * rnd(0.05, 0.10)
    rnd_exp = annual_budget * rnd(0.05, 0.15) if profile in ("elite", "large") else annual_budget * rnd(0.02, 0.07)
    scholarships = annual_budget * rnd(0.03, 0.08)
    food = annual_budget * rnd(0.02, 0.06)
    medical = annual_budget * rnd(0.01, 0.03)
    transport = annual_budget * rnd(0.01, 0.03)
    antiterror = annual_budget * rnd(0.005, 0.02)
    retraining = annual_budget * rnd(0.01, 0.03)
    olympiads = annual_budget * rnd(0.005, 0.02)
    extra_edu = annual_budget * rnd(0.01, 0.03)
    special_equip = annual_budget * rnd(0.02, 0.06)
    boarding = annual_budget * rnd(0.01, 0.04) if profile in ("elite", "large") else Decimal("0")

    funding_sources = [
        {"name": "Государственный заказ", "amount": float(state_order), "share": float(state_order / annual_budget * 100)},
        {"name": "Внебюджетные доходы", "amount": float(extra_income), "share": float(extra_income / annual_budget * 100)},
        {"name": "Гранты и проекты", "amount": float(rnd_exp * rnd(0.5, 1.0)), "share": float(rnd(3.0, 10.0))},
    ]

    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year, period_month=None,
        annual_budget=annual_budget,
        state_order_volume=state_order,
        extra_budget_income=extra_income,
        per_capita_norm=rnd(350000, 900000),
        state_order_start_date=date(year, 1, 1),
        state_order_end_date=date(year, 12, 31),
        state_order_planned_amount=state_order * rnd(0.95, 1.05),
        vouchers_issued=rint(100, 500) if profile in ("elite", "large") else rint(20, 150),
        payments_to_suppliers=annual_budget * rnd(0.08, 0.15),
        violations_info=None,
        return_notification_amount=annual_budget * rnd(0.001, 0.005),
        return_reason=None,
        expenses_payroll=payroll,
        expenses_utilities=utilities,
        expenses_antiterror=antiterror,
        expenses_food=food,
        expenses_medical=medical,
        expenses_retraining=retraining,
        expenses_olympiads=olympiads,
        expenses_extra_education=extra_edu,
        expenses_special_equipment=special_equip,
        expenses_transport=transport,
        expenses_rnd=rnd_exp,
        expenses_scholarships=scholarships,
        expenses_boarding=boarding,
        circle_price_per_session=rnd(2000, 8000),
        paid_services_price=rnd(50000, 250000),
        paid_vs_free_ratio=rnd(0.20, 0.45),
        budget_execution_report_url=f"https://edu.gov.kz/reports/{year}/{org_id}.pdf",
        payment_orders_count=rint(200, 1500),
        financing_requests_count=rint(50, 400),
        funding_sources_json=funding_sources,
        submission_status="approved",
        created_by=SUPERADMIN_ID, updated_by=SUPERADMIN_ID,
        created_at=datetime(year, 12, 31, 12, 0, tzinfo=timezone.utc),
        updated_at=datetime(year, 12, 31, 14, 0, tzinfo=timezone.utc),
    )


def make_science(org_id: UUID, year: int, profile: str) -> dict:
    p = SIZE_PARAMS[profile]
    hi_avg = rnd(*p["hirsch"])
    hi_max = hi_avg * rnd(1.3, 2.0)
    scopus = rint(50, 800) if profile in ("elite", "large") else rint(10, 200)
    wos = int(scopus * random.uniform(0.50, 0.80))
    q1 = int(wos * random.uniform(0.20, 0.40))
    q2 = int(wos * random.uniform(0.25, 0.35))
    q3 = int(wos * random.uniform(0.15, 0.25))
    q4 = wos - q1 - q2 - q3

    n_grants = rint(3, 15) if profile in ("elite", "large") else rint(1, 6)
    grants = [
        {
            "title": f"Грант МОН РК №{random.randint(100, 999)}-{year}",
            "amount": float(rnd(5_000_000, 50_000_000)),
            "direction": random.choice(DIRECTIONS),
            "duration_years": random.choice([1, 2, 3]),
            "status": random.choice(["active", "completed"]),
        }
        for _ in range(n_grants)
    ]
    n_projects = rint(2, 10)
    projects = [
        {
            "title": f"Студенческий проект «{random.choice(DIRECTIONS)} {year}»",
            "stage": random.choice(["идея", "MVP", "пилот", "масштабирование"]),
            "funding": float(rnd(500_000, 5_000_000)),
            "participants": rint(3, 20),
        }
        for _ in range(n_projects)
    ]

    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year,
        hirsch_index_avg=hi_avg,
        hirsch_index_max=hi_max,
        publications_scopus=scopus,
        publications_wos=wos,
        publications_q1=max(0, q1),
        publications_q2=max(0, q2),
        publications_q3=max(0, q3),
        publications_q4=max(0, q4),
        grants_json=grants,
        student_projects_json=projects,
        submission_status="approved",
        created_by=SUPERADMIN_ID, updated_by=SUPERADMIN_ID,
        created_at=datetime(year, 12, 31, 12, 0, tzinfo=timezone.utc),
        updated_at=datetime(year, 12, 31, 14, 0, tzinfo=timezone.utc),
    )


def make_graduates(org_id: UUID, year: int, profile: str) -> dict:
    p = SIZE_PARAMS[profile]
    total_students = rint(*p["students"])
    graduates_total = int(total_students * random.uniform(0.18, 0.28))
    to_tippo = int(graduates_total * random.uniform(0.05, 0.15))
    to_vipo = int(graduates_total * random.uniform(0.20, 0.40))
    to_top_vipo = int(to_vipo * random.uniform(0.10, 0.25))
    not_enrolled = int(graduates_total * random.uniform(0.03, 0.10))

    employed_6m = rnd(0.60, 0.92)
    employed_12m = min(Decimal("1.00"), employed_6m + rnd(0.03, 0.10))
    employed_36m = min(Decimal("1.00"), employed_12m + rnd(0.02, 0.05))
    employed_60m = min(Decimal("1.00"), employed_36m + rnd(0.01, 0.03))

    avg_salary = {s: float(rnd(150000, 450000)) for s in random.sample(SPECIALTIES, k=5)}
    achievements = [
        {"type": random.choice(["award", "patent", "startup"]),
         "name": f"Достижение {i}", "year": year}
        for i in range(rint(1, 5))
    ]
    legal_entities = {"count": rint(5, 50), "total_employees": rint(50, 500), "revenue_kzt": float(rnd(10_000_000, 500_000_000))}
    taxes_paid = {"total_kzt": float(rnd(5_000_000, 200_000_000)), "payers_count": rint(50, 500)}
    survey = {"satisfied_pct": float(rnd(65, 95)), "respondents": rint(200, 2000), "nps_score": float(rnd(20, 75))}
    employer_partners = [
        {"name": f"АО «Компания-{i}»", "sector": random.choice(["IT", "Финансы", "Строительство"]),
         "hired_count": rint(5, 50)}
        for i in range(rint(3, 8))
    ]

    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        graduation_year=year,
        graduates_total=graduates_total,
        to_tippo_count=to_tippo,
        to_vipo_count=to_vipo,
        to_top_vipo_count=to_top_vipo,
        not_enrolled_count=not_enrolled,
        final_attestation_avg_score=rnd(3.2, 4.5),
        final_attestation_pass_pct=rnd(85.0, 99.0),
        employed_6m_pct=employed_6m,
        employed_12m_pct=employed_12m,
        employed_36m_pct=employed_36m,
        employed_60m_pct=employed_60m,
        avg_salary_by_specialty_json=avg_salary,
        achievements_json=achievements,
        legal_entities_participation_json=legal_entities,
        taxes_paid_json=taxes_paid,
        survey_results_json=survey,
        employer_partners_json=employer_partners,
        grant_workback_amount=rnd(500_000, 10_000_000) if profile in ("elite", "large") else None,
        submission_status="approved",
        created_by=SUPERADMIN_ID, updated_by=SUPERADMIN_ID,
        created_at=datetime(year, 12, 31, 12, 0, tzinfo=timezone.utc),
        updated_at=datetime(year, 12, 31, 14, 0, tzinfo=timezone.utc),
    )


def make_education(org_id: UUID, year: int, profile: str) -> dict:
    additional_programs = [
        {"name": f"Программа «{random.choice(DIRECTIONS)}»", "hours": rint(36, 120),
         "enrolled": rint(20, 200), "certified_pct": float(rnd(70, 100))}
        for _ in range(rint(3, 10))
    ]
    circles = [
        {"name": f"Кружок {i}", "type": random.choice(["спорт", "творчество", "наука", "технологии"]),
         "participants": rint(10, 80), "price_per_session": float(rnd(1000, 5000))}
        for i in range(rint(5, 20))
    ]
    olympiads = [
        {"name": f"Олимпиада по {random.choice(DIRECTIONS)}", "level": random.choice(["вуз", "регион", "республика", "международный"]),
         "participants": rint(5, 50), "winners": rint(1, 10)}
        for _ in range(rint(3, 12))
    ]
    parent_survey = {"satisfaction_pct": float(rnd(65, 95)), "respondents": rint(100, 1000), "issues": []}
    academic_mobility = {
        "outbound_students": rint(10, 150),
        "inbound_students": rint(5, 80),
        "partner_countries": rint(3, 20),
        "programs": [random.choice(["Erasmus+", "Болашак", "DAAD"]) for _ in range(rint(1, 4))],
    }
    academic_performance = {
        "gpa_avg": float(rnd(3.0, 4.3)),
        "distinction_pct": float(rnd(10, 30)),
        "fail_pct": float(rnd(1, 8)),
        "year": year,
    }
    practice_partners = [
        {"name": f"Предприятие-{i}", "sector": random.choice(["IT", "Финансы", "Промышленность"]),
         "students_count": rint(10, 100)}
        for i in range(rint(5, 15))
    ]

    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        mandatory_programs_count=rint(10, 50),
        optional_programs_count=rint(5, 30),
        international_programs_count=rint(1, 10) if profile in ("elite", "large") else rint(0, 3),
        has_developing_environment=random.choice([True, True, False]),
        startup_projects_count=rint(0, 20),
        additional_programs_json=additional_programs,
        circles_sections_json=circles,
        olympiad_participation_json=olympiads,
        parent_survey_results_json=parent_survey,
        academic_mobility_json=academic_mobility,
        academic_performance_json=academic_performance,
        practice_partners_json=practice_partners,
        submission_status="approved",
        created_by=SUPERADMIN_ID, updated_by=SUPERADMIN_ID,
        created_at=datetime(year, 12, 31, 12, 0, tzinfo=timezone.utc),
        updated_at=datetime(year, 12, 31, 14, 0, tzinfo=timezone.utc),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Insert helpers (raw SQL — fastest for bulk inserts)
# ─────────────────────────────────────────────────────────────────────────────

import json as _json

def _j(v) -> str:
    """Serialize Python dict/list to JSON string for asyncpg JSONB binding."""
    return _json.dumps(v, ensure_ascii=False, default=str)


def _prep_jsonb(d: dict, *keys: str) -> dict:
    """Return a copy of d with JSONB keys serialized and UUIDs as strings."""
    out = {}
    for k, v in d.items():
        if isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    for k in keys:
        if out.get(k) is not None:
            out[k] = _j(out[k])
    return out


async def upsert_contingent(session: AsyncSession, d: dict) -> None:
    p = _prep_jsonb(d, "by_grade_json", "by_specialty_json", "prize_winners_json")
    await session.execute(text("""
        INSERT INTO contingent_snapshots (
            org_id, source_id, snapshot_date,
            total_count, new_enrolled, withdrawn,
            bachelor_count, master_count, phd_count,
            full_time_count, distance_count,
            budget_count, paid_count,
            kz_lang_count, ru_lang_count, en_lang_count, other_lang_count,
            foreign_count,
            many_children_count, low_income_count, disabled_count,
            orphan_count, oop_count,
            privileged_share, boarding_school_count, absences_count,
            by_grade_json, by_specialty_json, prize_winners_json,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :snapshot_date,
            :total_count, :new_enrolled, :withdrawn,
            :bachelor_count, :master_count, :phd_count,
            :full_time_count, :distance_count,
            :budget_count, :paid_count,
            :kz_lang_count, :ru_lang_count, :en_lang_count, :other_lang_count,
            :foreign_count,
            :many_children_count, :low_income_count, :disabled_count,
            :orphan_count, :oop_count,
            :privileged_share, :boarding_school_count, :absences_count,
            cast(:by_grade_json as jsonb), cast(:by_specialty_json as jsonb),
            cast(:prize_winners_json as jsonb),
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        )
        ON CONFLICT (org_id, snapshot_date) DO UPDATE SET
            total_count = EXCLUDED.total_count,
            new_enrolled = EXCLUDED.new_enrolled,
            withdrawn = EXCLUDED.withdrawn,
            bachelor_count = EXCLUDED.bachelor_count,
            master_count = EXCLUDED.master_count,
            phd_count = EXCLUDED.phd_count,
            full_time_count = EXCLUDED.full_time_count,
            distance_count = EXCLUDED.distance_count,
            budget_count = EXCLUDED.budget_count,
            paid_count = EXCLUDED.paid_count,
            kz_lang_count = EXCLUDED.kz_lang_count,
            ru_lang_count = EXCLUDED.ru_lang_count,
            en_lang_count = EXCLUDED.en_lang_count,
            other_lang_count = EXCLUDED.other_lang_count,
            foreign_count = EXCLUDED.foreign_count,
            many_children_count = EXCLUDED.many_children_count,
            low_income_count = EXCLUDED.low_income_count,
            disabled_count = EXCLUDED.disabled_count,
            orphan_count = EXCLUDED.orphan_count,
            oop_count = EXCLUDED.oop_count,
            privileged_share = EXCLUDED.privileged_share,
            boarding_school_count = EXCLUDED.boarding_school_count,
            absences_count = EXCLUDED.absences_count,
            by_grade_json = EXCLUDED.by_grade_json,
            by_specialty_json = EXCLUDED.by_specialty_json,
            prize_winners_json = EXCLUDED.prize_winners_json,
            submission_status = EXCLUDED.submission_status,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at,
            deleted_at = NULL
    """), p)


async def upsert_finance(session: AsyncSession, d: dict) -> None:
    p = _prep_jsonb(d, "funding_sources_json")
    # PostgreSQL UNIQUE does not match NULL=NULL, so period_month IS NULL rows
    # won't trigger ON CONFLICT. Use DELETE+INSERT for annual records.
    await session.execute(text("""
        DELETE FROM finance_records
        WHERE org_id = :org_id AND period_year = :period_year AND period_month IS NULL
    """), {"org_id": p["org_id"], "period_year": p["period_year"]})
    await session.execute(text("""
        INSERT INTO finance_records (
            org_id, source_id, period_year, period_month,
            annual_budget, state_order_volume, extra_budget_income,
            per_capita_norm, state_order_start_date, state_order_end_date,
            state_order_planned_amount, vouchers_issued, payments_to_suppliers,
            violations_info, return_notification_amount, return_reason,
            expenses_payroll, expenses_utilities, expenses_antiterror,
            expenses_food, expenses_medical, expenses_retraining,
            expenses_olympiads, expenses_extra_education, expenses_special_equipment,
            expenses_transport, expenses_rnd, expenses_scholarships, expenses_boarding,
            circle_price_per_session, paid_services_price, paid_vs_free_ratio,
            budget_execution_report_url, payment_orders_count, financing_requests_count,
            funding_sources_json,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :period_year, :period_month,
            :annual_budget, :state_order_volume, :extra_budget_income,
            :per_capita_norm, :state_order_start_date, :state_order_end_date,
            :state_order_planned_amount, :vouchers_issued, :payments_to_suppliers,
            :violations_info, :return_notification_amount, :return_reason,
            :expenses_payroll, :expenses_utilities, :expenses_antiterror,
            :expenses_food, :expenses_medical, :expenses_retraining,
            :expenses_olympiads, :expenses_extra_education, :expenses_special_equipment,
            :expenses_transport, :expenses_rnd, :expenses_scholarships, :expenses_boarding,
            :circle_price_per_session, :paid_services_price, :paid_vs_free_ratio,
            :budget_execution_report_url, :payment_orders_count, :financing_requests_count,
            cast(:funding_sources_json as jsonb),
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        )
    """), p)


async def upsert_science(session: AsyncSession, d: dict) -> None:
    p = _prep_jsonb(d, "grants_json", "student_projects_json")
    await session.execute(text("""
        INSERT INTO science_activity (
            org_id, source_id, period_year,
            hirsch_index_avg, hirsch_index_max,
            publications_scopus, publications_wos,
            publications_q1, publications_q2, publications_q3, publications_q4,
            grants_json, student_projects_json,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :period_year,
            :hirsch_index_avg, :hirsch_index_max,
            :publications_scopus, :publications_wos,
            :publications_q1, :publications_q2, :publications_q3, :publications_q4,
            cast(:grants_json as jsonb), cast(:student_projects_json as jsonb),
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        )
        ON CONFLICT (org_id, period_year) DO UPDATE SET
            hirsch_index_avg = EXCLUDED.hirsch_index_avg,
            hirsch_index_max = EXCLUDED.hirsch_index_max,
            publications_scopus = EXCLUDED.publications_scopus,
            publications_wos = EXCLUDED.publications_wos,
            publications_q1 = EXCLUDED.publications_q1,
            publications_q2 = EXCLUDED.publications_q2,
            publications_q3 = EXCLUDED.publications_q3,
            publications_q4 = EXCLUDED.publications_q4,
            grants_json = EXCLUDED.grants_json,
            student_projects_json = EXCLUDED.student_projects_json,
            submission_status = EXCLUDED.submission_status,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at,
            deleted_at = NULL
    """), p)


async def upsert_graduates(session: AsyncSession, d: dict) -> None:
    p = _prep_jsonb(d, "avg_salary_by_specialty_json", "achievements_json",
                    "legal_entities_participation_json", "taxes_paid_json",
                    "survey_results_json", "employer_partners_json")
    await session.execute(text("""
        INSERT INTO graduates_records (
            org_id, source_id, graduation_year,
            graduates_total, to_tippo_count, to_vipo_count, to_top_vipo_count, not_enrolled_count,
            final_attestation_avg_score, final_attestation_pass_pct,
            employed_6m_pct, employed_12m_pct, employed_36m_pct, employed_60m_pct,
            avg_salary_by_specialty_json, achievements_json,
            legal_entities_participation_json, taxes_paid_json,
            survey_results_json, employer_partners_json,
            grant_workback_amount,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :graduation_year,
            :graduates_total, :to_tippo_count, :to_vipo_count, :to_top_vipo_count, :not_enrolled_count,
            :final_attestation_avg_score, :final_attestation_pass_pct,
            :employed_6m_pct, :employed_12m_pct, :employed_36m_pct, :employed_60m_pct,
            cast(:avg_salary_by_specialty_json as jsonb), cast(:achievements_json as jsonb),
            cast(:legal_entities_participation_json as jsonb), cast(:taxes_paid_json as jsonb),
            cast(:survey_results_json as jsonb), cast(:employer_partners_json as jsonb),
            :grant_workback_amount,
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        )
        ON CONFLICT (org_id, graduation_year) DO UPDATE SET
            graduates_total = EXCLUDED.graduates_total,
            to_tippo_count = EXCLUDED.to_tippo_count,
            to_vipo_count = EXCLUDED.to_vipo_count,
            to_top_vipo_count = EXCLUDED.to_top_vipo_count,
            not_enrolled_count = EXCLUDED.not_enrolled_count,
            final_attestation_avg_score = EXCLUDED.final_attestation_avg_score,
            final_attestation_pass_pct = EXCLUDED.final_attestation_pass_pct,
            employed_6m_pct = EXCLUDED.employed_6m_pct,
            employed_12m_pct = EXCLUDED.employed_12m_pct,
            employed_36m_pct = EXCLUDED.employed_36m_pct,
            employed_60m_pct = EXCLUDED.employed_60m_pct,
            avg_salary_by_specialty_json = EXCLUDED.avg_salary_by_specialty_json,
            achievements_json = EXCLUDED.achievements_json,
            legal_entities_participation_json = EXCLUDED.legal_entities_participation_json,
            taxes_paid_json = EXCLUDED.taxes_paid_json,
            survey_results_json = EXCLUDED.survey_results_json,
            employer_partners_json = EXCLUDED.employer_partners_json,
            grant_workback_amount = EXCLUDED.grant_workback_amount,
            submission_status = EXCLUDED.submission_status,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at,
            deleted_at = NULL
    """), p)


async def upsert_education(session: AsyncSession, d: dict) -> None:
    p = _prep_jsonb(d, "additional_programs_json", "circles_sections_json",
                    "olympiad_participation_json", "parent_survey_results_json",
                    "academic_mobility_json", "academic_performance_json", "practice_partners_json")
    await session.execute(text("""
        INSERT INTO educational_process (
            org_id, source_id, snapshot_date,
            mandatory_programs_count, optional_programs_count, international_programs_count,
            has_developing_environment, startup_projects_count,
            additional_programs_json, circles_sections_json, olympiad_participation_json,
            parent_survey_results_json, academic_mobility_json,
            academic_performance_json, practice_partners_json,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :snapshot_date,
            :mandatory_programs_count, :optional_programs_count, :international_programs_count,
            :has_developing_environment, :startup_projects_count,
            cast(:additional_programs_json as jsonb), cast(:circles_sections_json as jsonb),
            cast(:olympiad_participation_json as jsonb), cast(:parent_survey_results_json as jsonb),
            cast(:academic_mobility_json as jsonb), cast(:academic_performance_json as jsonb),
            cast(:practice_partners_json as jsonb),
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        )
        ON CONFLICT (org_id, snapshot_date) DO UPDATE SET
            mandatory_programs_count = EXCLUDED.mandatory_programs_count,
            optional_programs_count = EXCLUDED.optional_programs_count,
            international_programs_count = EXCLUDED.international_programs_count,
            has_developing_environment = EXCLUDED.has_developing_environment,
            startup_projects_count = EXCLUDED.startup_projects_count,
            additional_programs_json = EXCLUDED.additional_programs_json,
            circles_sections_json = EXCLUDED.circles_sections_json,
            olympiad_participation_json = EXCLUDED.olympiad_participation_json,
            parent_survey_results_json = EXCLUDED.parent_survey_results_json,
            academic_mobility_json = EXCLUDED.academic_mobility_json,
            academic_performance_json = EXCLUDED.academic_performance_json,
            practice_partners_json = EXCLUDED.practice_partners_json,
            submission_status = EXCLUDED.submission_status,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at,
            deleted_at = NULL
    """), p)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

async def main() -> int:
    random.seed(42)
    print("=" * 60)
    print("EDU Monitoring — Комплексный сид данных 2020-2025")
    print("=" * 60)

    await init_db()

    total = len(ORGS) * len(YEARS)
    done = 0

    async with AsyncWriteSession() as session:
        for org_id, (name, profile) in ORGS.items():
            print(f"\n[{name}] ({profile})")
            for year in YEARS:
                try:
                    await upsert_contingent(session, make_contingent(org_id, year, profile))
                    await upsert_finance(session, make_finance(org_id, year, profile))
                    await upsert_science(session, make_science(org_id, year, profile))
                    await upsert_graduates(session, make_graduates(org_id, year, profile))
                    await upsert_education(session, make_education(org_id, year, profile))
                    done += 1
                    print(f"  {year} ✓  ({done}/{total})", end="\r", flush=True)
                except Exception as e:
                    print(f"\n  ❌ {year}: {e}")
                    await session.rollback()
                    return 1

            await session.commit()
            print(f"  2020-2025 ✓✓  — {name}")

    print("\n")
    print("=" * 60)
    print("✅  Данные успешно загружены.")
    print(f"   Организаций: {len(ORGS)}")
    print(f"   Лет: {len(YEARS)} (2020-2025)")
    print(f"   Записей (5 таблиц × {len(ORGS)} × {len(YEARS)}): {5 * len(ORGS) * len(YEARS)}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
