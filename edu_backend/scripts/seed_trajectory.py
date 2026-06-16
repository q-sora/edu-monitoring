"""
scripts/seed_trajectory.py
──────────────────────────────────────────────────────────────────────────────
Генерация симулированных данных траектории учащихся.

Когорта из 3 групп (по умолчанию 120 студентов):
  • 25% — отличники (ЕНТ 100–140)
  • 42% — хорошисты (ЕНТ 70–99)
  • 33% — слабые (ЕНТ 40–69)

Для каждого студента генерируются:
  student_registry    — базовые данные (ИИН, ЕНТ, специальность)
  student_academic    — GPA по семестрам (4 года = 8 семестров)
  student_employment  — занятость через год после выпуска
  student_salary      — зарплата (4 квартала, год после выпуска)

Запуск:
    docker compose exec api python -m scripts.seed_trajectory
    docker compose exec api python -m scripts.seed_trajectory --org-id <UUID> --year 2024 --count 200
"""
from __future__ import annotations

import argparse
import asyncio
import math
import random
import sys
import uuid
from decimal import Decimal

from sqlalchemy import text

# ── Bootstrap: ensure app package is on the path ─────────────────────────────
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.database import engine_write, init_db

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

SPECIALTIES = [
    ("6B01501", "Педагогика и методика начального обучения"),
    ("6B06101", "Информационные системы"),
    ("6B07201", "Технология продовольственных продуктов"),
    ("6B04101", "Финансы"),
    ("6B03202", "История"),
    ("6B05301", "Биология"),
    ("6B07102", "Информационная безопасность"),
    ("6B04201", "Учёт и аудит"),
]

EMPLOYERS = [
    ("АО «Казахтелеком»",      "160840021610"),
    ("ТОО «KPMG Казахстан»",   "081040010699"),
    ("АО «Halyk Bank»",         "920240000200"),
    ("АО «НК «Казмунайгаз»",   "040240006681"),
    ("АО «Самрук-Казына»",      "060240006640"),
    ("ГКП «Городская клиника»", "010640003000"),
    ("ТОО «1С-Рарус»",          "120140012590"),
    ("НАО «НИШ»",               "110140008370"),
]


# ─────────────────────────────────────────────────────────────────────────────
# Cohort generators
# ─────────────────────────────────────────────────────────────────────────────

def _rnd(a: float, b: float) -> float:
    return random.uniform(a, b)

def _rint(a: int, b: int) -> int:
    return random.randint(a, b)

def _clamp(v: float, a: float, b: float) -> float:
    return max(a, min(b, v))

def _r2(v: float) -> float:
    return round(v, 2)


def _make_iin(year: int, idx: int) -> str:
    """Generates a deterministic fake ИИН: 9{year%100:02d}{idx:09d}."""
    return f"9{year % 100:02d}{idx:09d}"


def _gpa_trend(base_gpa: float, semester: int, noise: float = 0.25) -> float:
    """Simulates GPA drift across semesters. Slight drift up or down."""
    drift = _rnd(-noise, noise)
    return _r2(_clamp(base_gpa + drift * (semester / 8), 2.0, 5.0))


def generate_cohort(count: int, year: int, level: str) -> list[dict]:
    """Returns a list of student dicts with all sub-records."""
    random.seed(42)  # reproducible run
    enroll_year = year - (4 if level in ("bachelor", "master", "phd") else 3)

    honour_n = math.floor(count * 0.25)
    good_n   = math.floor(count * 0.42)
    weak_n   = count - honour_n - good_n

    cohorts = [
        ("honour", honour_n, (100, 140), (3.8, 5.0), 0.08, 0.22, (280_000, 560_000)),
        ("good",   good_n,   ( 70,  99), (2.9, 4.5), 0.18, 0.38, (180_000, 390_000)),
        ("weak",   weak_n,   ( 40,  69), (2.0, 3.5), 0.38, 0.58, ( 95_000, 260_000)),
    ]

    students: list[dict] = []
    idx = 0

    for cohort_name, n, ent_range, gpa_range, unemp_chance, mismatch_chance, sal_range in cohorts:
        for local_i in range(n):
            iin = _make_iin(year, idx)
            ent = _rint(*ent_range)
            base_gpa = _r2(_clamp(_rnd(*gpa_range), 2.0, 5.0))
            is_grant  = cohort_name == "honour" and random.random() > 0.3

            spec_code, spec_name = random.choice(SPECIALTIES)

            # Academic records (8 semesters)
            academic: list[dict] = []
            for sem in range(1, 9):
                acad_year = enroll_year + (sem - 1) // 2
                gpa = _gpa_trend(base_gpa, sem)
                academic.append({
                    "academic_year":   acad_year,
                    "semester_number": sem,
                    "gpa":             Decimal(str(gpa)),
                    "credits_earned":  _rint(24, 30),
                })

            final_gpa = academic[-1]["gpa"]
            graduated = float(final_gpa) >= 2.5

            # Employment (year after graduation)
            employ_year = year + 1
            if not graduated:
                emp = {"period_year": employ_year, "employment_status": "unemployed", "specialty_match": False}
            elif random.random() < unemp_chance:
                emp = {"period_year": employ_year, "employment_status": "unemployed", "specialty_match": False}
            else:
                employer_name, employer_bin = random.choice(EMPLOYERS)
                match = random.random() > mismatch_chance
                months = _rint(1, 12)
                emp = {
                    "period_year":       employ_year,
                    "employment_status": "employed",
                    "employer_name":     employer_name,
                    "employer_bin":      employer_bin,
                    "specialty_match":   match,
                    "months_to_employ":  months,
                }

            # Salary (4 quarters of employ_year)
            salary: list[dict] = []
            if emp["employment_status"] == "employed":
                base_sal = Decimal(str(_rint(*sal_range)))
                for q in range(1, 5):
                    noise = Decimal(str(_rint(-10_000, 25_000)))
                    s = max(Decimal("50000"), base_sal + noise)
                    ipn = (s * Decimal("0.10")).quantize(Decimal("0.01"))
                    pension = (s * Decimal("0.10")).quantize(Decimal("0.01"))
                    salary.append({
                        "period_year":    employ_year,
                        "period_quarter": q,
                        "salary_amount":  s.quantize(Decimal("0.01")),
                        "ipn_amount":     ipn,
                        "pension_amount": pension,
                        "source_type":    "kgd",
                    })

            students.append({
                "iin":              iin,
                "education_level":  level,
                "specialty_code":   spec_code,
                "specialty_name":   spec_name,
                "graduation_year":  year,
                "enrollment_year":  enroll_year,
                "ent_score":        ent,
                "is_grant":         is_grant,
                "academic":         academic,
                "employment":       emp,
                "salary":           salary,
            })
            idx += 1

    return students


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────────────────────────────────────

async def get_or_create_org(conn, org_id_arg: str | None) -> str:
    if org_id_arg:
        row = await conn.execute(
            text("SELECT id FROM organizations WHERE id = CAST(:id AS uuid)"),
            {"id": org_id_arg},
        )
        existing = row.scalar()
        if not existing:
            print(f"[ERROR] Организация {org_id_arg} не найдена в БД.", file=sys.stderr)
            sys.exit(1)
        return str(existing)

    # Try first existing org
    row = await conn.execute(text("SELECT id FROM organizations LIMIT 1"))
    existing = row.scalar()
    if existing:
        print(f"[INFO] Используется первая организация из БД: {existing}")
        return str(existing)

    # Create demo org
    demo_id = str(uuid.uuid4())
    await conn.execute(
        text("""
            INSERT INTO organizations (id, name_ru, status)
            VALUES (CAST(:id AS uuid), :name, 'active')
        """),
        {"id": demo_id, "name": "Демо-организация ТиПО (автоматически создана seed-скриптом)"},
    )
    print(f"[INFO] Создана демо-организация: {demo_id}")
    return demo_id


async def insert_student(conn, student: dict, org_id: str) -> None:
    emp = student["employment"]

    await conn.execute(
        text("""
            INSERT INTO student_registry
                (iin, org_id, education_level, specialty_code, specialty_name,
                 graduation_year, enrollment_year, ent_score, is_grant)
            VALUES
                (:iin, CAST(:org_id AS uuid), :edu_level, :spec_code, :spec_name,
                 :grad_year, :enroll_year, :ent_score, :is_grant)
            ON CONFLICT (iin) DO NOTHING
        """),
        {
            "iin":        student["iin"],
            "org_id":     org_id,
            "edu_level":  student["education_level"],
            "spec_code":  student["specialty_code"],
            "spec_name":  student["specialty_name"],
            "grad_year":  student["graduation_year"],
            "enroll_year": student["enrollment_year"],
            "ent_score":  student["ent_score"],
            "is_grant":   student["is_grant"],
        },
    )

    for acad in student["academic"]:
        await conn.execute(
            text("""
                INSERT INTO student_academic
                    (iin, academic_year, semester_number, gpa, credits_earned)
                VALUES
                    (:iin, :acad_year, :sem_num, :gpa, :credits)
                ON CONFLICT (iin, academic_year, semester_number) DO NOTHING
            """),
            {
                "iin":      student["iin"],
                "acad_year": acad["academic_year"],
                "sem_num":  acad["semester_number"],
                "gpa":      acad["gpa"],
                "credits":  acad["credits_earned"],
            },
        )

    await conn.execute(
        text("""
            INSERT INTO student_employment
                (iin, period_year, employment_status, employer_name, employer_bin,
                 specialty_match, months_to_employ)
            VALUES
                (:iin, :year, :status, :emp_name, :emp_bin, :match, :months)
            ON CONFLICT (iin, period_year) DO NOTHING
        """),
        {
            "iin":      student["iin"],
            "year":     emp["period_year"],
            "status":   emp["employment_status"],
            "emp_name": emp.get("employer_name"),
            "emp_bin":  emp.get("employer_bin"),
            "match":    emp.get("specialty_match"),
            "months":   emp.get("months_to_employ"),
        },
    )

    for sal in student["salary"]:
        await conn.execute(
            text("""
                INSERT INTO student_salary
                    (iin, period_year, period_quarter, salary_amount, ipn_amount,
                     pension_amount, source_type)
                VALUES
                    (:iin, :year, :quarter, :salary, :ipn, :pension, :src)
                ON CONFLICT (iin, period_year, period_quarter, source_type) DO NOTHING
            """),
            {
                "iin":     student["iin"],
                "year":    sal["period_year"],
                "quarter": sal["period_quarter"],
                "salary":  sal["salary_amount"],
                "ipn":     sal["ipn_amount"],
                "pension": sal["pension_amount"],
                "src":     sal["source_type"],
            },
        )


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed student trajectory simulation data")
    p.add_argument("--org-id",  default=None, help="UUID организации (по умолчанию: первая из БД или новая демо)")
    p.add_argument("--year",    type=int, default=2024, help="Год выпуска когорты (default: 2024)")
    p.add_argument("--count",   type=int, default=120,  help="Число студентов (default: 120)")
    p.add_argument("--level",   default="bachelor",
                   choices=["tippo", "bachelor", "master", "phd"],
                   help="Уровень образования (default: bachelor)")
    return p.parse_args()


async def main() -> None:
    args = parse_args()

    print(f"[INFO] Инициализация БД...")
    await init_db()

    students = generate_cohort(args.count, args.year, args.level)
    print(f"[INFO] Сгенерировано {len(students)} студентов (когорта {args.year}, {args.level})")

    created = 0
    skipped = 0

    async with engine_write.begin() as conn:
        org_id = await get_or_create_org(conn, args.org_id)
        print(f"[INFO] Организация: {org_id}")

        for i, stu in enumerate(students):
            sp = f"sp_stu_{i}"
            try:
                await conn.execute(text(f"SAVEPOINT {sp}"))
                await insert_student(conn, stu, org_id)
                await conn.execute(text(f"RELEASE SAVEPOINT {sp}"))
                created += 1
            except Exception as exc:
                await conn.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))
                skipped += 1
                if i < 5:  # only log first few errors to avoid noise
                    print(f"[WARN] ИИН {stu['iin']}: {exc}", file=sys.stderr)

    print(f"\n[DONE] Создано: {created} | Пропущено (дубликаты): {skipped}")
    print(f"       Страница траектории: /analytics/trajectory → выберите организацию, год {args.year}")


if __name__ == "__main__":
    asyncio.run(main())
