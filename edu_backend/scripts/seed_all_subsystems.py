"""
scripts/seed_all_subsystems.py
─────────────────────────────────────────────────────────────────────────────
Создаёт организации для ВСЕХ 7 подсистем образования + данные 2020-2025.

Подсистемы:
  1. ДО    — Дошкольное образование (детские сады)
  2. ДопО  — Дополнительное образование (кружки, дворцы школьников)
  3. СО    — Среднее образование (школы, НИШ)
  4. ТиППО — Техническое и профессиональное образование (колледжи)
  5. ВиПО  — Высшее и послевузовское образование (уже есть, пропускаем)
  6. Общ-е — Общежития / студенческое жильё
  7. ГОНС  — ГОНС Келешек (операторы системы накоплений)

Запуск:
    docker compose exec api python -m scripts.seed_all_subsystems
"""
from __future__ import annotations

import asyncio
import json as _json
import random
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncWriteSession, init_db

# ─────────────────────────────────────────────────────────────────────────────
# Конфиг
# ─────────────────────────────────────────────────────────────────────────────

SUPERADMIN_ID = "5222215e-4fa6-4f9b-b3d2-8d783e5993da"
SOURCE_ID = 1
YEARS = list(range(2020, 2026))

# org_type_id из БД
OT = {"ДО": 1, "ДопО": 2, "СО": 3, "ТиППО": 4, "ВиПО": 5, "Общ-е": 6, "ГОНС": 7}
# ownership_form_id
OF = {"state": 1, "private": 2, "ppp": 3, "municipal": 4, "national": 5}
# region_id (из БД)
REG = {
    "Астана": 1, "Алматы": 2, "Шымкент": 3, "Акмолинская": 4,
    "Актюбинская": 5, "Алматинская": 6, "Атырауская": 7, "ЗКО": 8,
    "Жамбылская": 9, "Жетісу": 10, "Карагандинская": 11, "Костанайская": 12,
    "Кызылординская": 13, "Мангистауская": 14, "Павлодарская": 15,
    "СКО": 16, "Туркестанская": 17, "Ұлытау": 18, "Абай": 19, "ВКО": 20,
}

DIRECTIONS = ["ИКТ", "Педагогика", "Право", "Экономика",
              "Инженерия", "Медицина", "Естественные науки", "Спорт", "Искусство"]

# ─────────────────────────────────────────────────────────────────────────────
# Организации для создания (все, кроме ВиПО — они уже есть)
# ─────────────────────────────────────────────────────────────────────────────

NEW_ORGS = [
    # ── ДО: Дошкольное образование ──────────────────────────────────────────
    {"bin": "200100000101", "name_ru": 'ДС "Балапан" г. Астана',        "org_type": "ДО", "ownership": "municipal", "region": "Астана",       "size": "medium"},
    {"bin": "200100000102", "name_ru": 'ДС "Балдырған" г. Алматы',      "org_type": "ДО", "ownership": "municipal", "region": "Алматы",       "size": "large"},
    {"bin": "200100000103", "name_ru": 'ДС "Айгүл" г. Шымкент',         "org_type": "ДО", "ownership": "state",     "region": "Шымкент",      "size": "small"},
    {"bin": "200100000104", "name_ru": 'ДС "Жұлдыз" Атырауская обл.',   "org_type": "ДО", "ownership": "municipal", "region": "Атырауская",   "size": "small"},
    {"bin": "200100000105", "name_ru": 'ДС "Гүлдер" Алматинская обл.',  "org_type": "ДО", "ownership": "private",   "region": "Алматинская",  "size": "small"},
    {"bin": "200100000106", "name_ru": 'ДС "Нұрлы Жол" Акмолинская',    "org_type": "ДО", "ownership": "municipal", "region": "Акмолинская",  "size": "small"},
    {"bin": "200100000107", "name_ru": 'ДС "Ботакөз" г. Шымкент',       "org_type": "ДО", "ownership": "private",   "region": "Шымкент",      "size": "medium"},
    {"bin": "200100000108", "name_ru": 'ДС "Қуаным" Карагандинская',     "org_type": "ДО", "ownership": "municipal", "region": "Карагандинская","size": "medium"},
    {"bin": "200100000109", "name_ru": 'ДС "Мерей" Туркестанская обл.', "org_type": "ДО", "ownership": "state",     "region": "Туркестанская", "size": "small"},

    # ── ДопО: Дополнительное образование ────────────────────────────────────
    {"bin": "200200000201", "name_ru": 'ЦДТ "Өнер" г. Астана',                  "org_type": "ДопО", "ownership": "municipal", "region": "Астана",        "size": "large"},
    {"bin": "200200000202", "name_ru": 'Дворец школьников "Жас Ұлан" г. Алматы',"org_type": "ДопО", "ownership": "state",     "region": "Алматы",        "size": "large"},
    {"bin": "200200000203", "name_ru": 'СДЮСШ "Барыс" г. Шымкент',              "org_type": "ДопО", "ownership": "municipal", "region": "Шымкент",       "size": "medium"},
    {"bin": "200200000204", "name_ru": 'ДМШ "Гармония" г. Астана',               "org_type": "ДопО", "ownership": "municipal", "region": "Астана",        "size": "small"},
    {"bin": "200200000205", "name_ru": 'Центр робототехники "Болашак" Алматы',   "org_type": "ДопО", "ownership": "private",   "region": "Алматы",        "size": "small"},
    {"bin": "200200000206", "name_ru": 'ДДТ "Арман" Карагандинская обл.',        "org_type": "ДопО", "ownership": "municipal", "region": "Карагандинская","size": "medium"},
    {"bin": "200200000207", "name_ru": 'Центр технического творчества Павлодар',  "org_type": "ДопО", "ownership": "municipal", "region": "Павлодарская",  "size": "small"},

    # ── СО: Среднее образование ──────────────────────────────────────────────
    {"bin": "200300000301", "name_ru": 'СОШ №1 им. Абая г. Астана',           "org_type": "СО", "ownership": "state",     "region": "Астана",        "size": "large"},
    {"bin": "200300000302", "name_ru": 'НИШ г. Астана',                        "org_type": "СО", "ownership": "national",  "region": "Астана",        "size": "elite"},
    {"bin": "200300000303", "name_ru": 'НИШ г. Алматы',                        "org_type": "СО", "ownership": "national",  "region": "Алматы",        "size": "elite"},
    {"bin": "200300000304", "name_ru": 'СОШ №15 г. Алматы',                    "org_type": "СО", "ownership": "state",     "region": "Алматы",        "size": "large"},
    {"bin": "200300000305", "name_ru": 'Школа-лицей "Білім" г. Шымкент',       "org_type": "СО", "ownership": "state",     "region": "Шымкент",       "size": "medium"},
    {"bin": "200300000306", "name_ru": 'СОШ №8 им. Гагарина Карагандинская',   "org_type": "СО", "ownership": "municipal",  "region": "Карагандинская","size": "medium"},
    {"bin": "200300000307", "name_ru": 'Частная школа "Мирас" г. Алматы',      "org_type": "СО", "ownership": "private",   "region": "Алматы",        "size": "medium"},
    {"bin": "200300000308", "name_ru": 'СОШ им. Толстого г. Костанай',         "org_type": "СО", "ownership": "municipal",  "region": "Костанайская",  "size": "small"},

    # ── ТиППО: Техническое и профессиональное образование ───────────────────
    {"bin": "200400000401", "name_ru": 'Колледж "Технология" г. Астана',        "org_type": "ТиППО", "ownership": "state",    "region": "Астана",        "size": "large"},
    {"bin": "200400000402", "name_ru": 'Политехнический колледж г. Алматы',     "org_type": "ТиППО", "ownership": "state",    "region": "Алматы",        "size": "large"},
    {"bin": "200400000403", "name_ru": 'Строительный колледж г. Шымкент',       "org_type": "ТиППО", "ownership": "state",    "region": "Шымкент",       "size": "medium"},
    {"bin": "200400000404", "name_ru": 'Медицинский колледж г. Актобе',         "org_type": "ТиППО", "ownership": "state",    "region": "Актюбинская",   "size": "medium"},
    {"bin": "200400000405", "name_ru": 'Аграрный колледж Акмолинская обл.',     "org_type": "ТиППО", "ownership": "state",    "region": "Акмолинская",   "size": "small"},
    {"bin": "200400000406", "name_ru": 'Колледж ИТ и связи г. Алматы',         "org_type": "ТиППО", "ownership": "private",  "region": "Алматы",        "size": "medium"},
    {"bin": "200400000407", "name_ru": 'Транспортный колледж г. Шымкент',       "org_type": "ТиППО", "ownership": "state",    "region": "Шымкент",       "size": "small"},
    {"bin": "200400000408", "name_ru": 'Горно-металлургический колледж КарТУ',  "org_type": "ТиППО", "ownership": "ppp",      "region": "Карагандинская","size": "medium"},

    # ── Общ-е: Общежития / студенческое жильё ───────────────────────────────
    {"bin": "200600000601", "name_ru": 'Студенческое общежитие КазНУ №1',   "org_type": "Общ-е", "ownership": "state",    "region": "Алматы",  "size": "large"},
    {"bin": "200600000602", "name_ru": 'Студгородок Назарбаев Университет', "org_type": "Общ-е", "ownership": "national", "region": "Астана",  "size": "large"},
    {"bin": "200600000603", "name_ru": 'Общежитие ЕНУ №2 г. Астана',       "org_type": "Общ-е", "ownership": "state",    "region": "Астана",  "size": "medium"},
    {"bin": "200600000604", "name_ru": 'Студенческий кампус КарТУ',         "org_type": "Общ-е", "ownership": "state",    "region": "Карагандинская","size": "medium"},
    {"bin": "200600000605", "name_ru": 'Молодёжный кампус "Жастар" Алматы', "org_type": "Общ-е", "ownership": "private",  "region": "Алматы",  "size": "small"},
    {"bin": "200600000606", "name_ru": 'Общежитие КазНТУ г. Алматы',       "org_type": "Общ-е", "ownership": "state",    "region": "Алматы",  "size": "medium"},

    # ── ГОНС: ГОНС Келешек ──────────────────────────────────────────────────
    {"bin": "200700000701", "name_ru": 'АО "Отбасы банк" — оператор ГОНС',      "org_type": "ГОНС", "ownership": "state",   "region": "Астана", "size": "elite"},
    {"bin": "200700000702", "name_ru": 'АО "Халык Банк" — оператор ГОНС',       "org_type": "ГОНС", "ownership": "private",  "region": "Астана", "size": "large"},
    {"bin": "200700000703", "name_ru": 'АО "Kaspi Bank" — оператор Келешек',    "org_type": "ГОНС", "ownership": "private",  "region": "Алматы", "size": "large"},
    {"bin": "200700000704", "name_ru": 'АО "ForteBank" — оператор ГОНС',        "org_type": "ГОНС", "ownership": "private",  "region": "Алматы", "size": "medium"},
    {"bin": "200700000705", "name_ru": 'АО "Jusan Bank" — оператор Келешек',    "org_type": "ГОНС", "ownership": "private",  "region": "Астана", "size": "medium"},
]

# Профили размера → базовые числа
SIZE = {
    "elite":  {"children": (800, 1500),   "budget_m": (15000, 40000), "hirsch": (10, 18)},
    "large":  {"children": (400, 800),    "budget_m": (3000,  10000), "hirsch": (3,  8)},
    "medium": {"children": (150, 400),    "budget_m": (800,   3000),  "hirsch": (1,  4)},
    "small":  {"children": (50,  150),    "budget_m": (200,   800),   "hirsch": (0,  2)},
}

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def rnd(lo: float, hi: float, digits: int = 2) -> Decimal:
    return round(Decimal(str(random.uniform(lo, hi))), digits)

def rint(lo: int, hi: int) -> int:
    return random.randint(lo, hi)

def j(v) -> str:
    return _json.dumps(v, ensure_ascii=False, default=str)

def prep(d: dict, *jsonb_keys: str) -> dict:
    out = {}
    for k, v in d.items():
        out[k] = str(v) if isinstance(v, UUID) else v
    for k in jsonb_keys:
        if out.get(k) is not None:
            out[k] = j(out[k])
    return out

def base_audit(year: int) -> dict:
    return dict(
        created_by=SUPERADMIN_ID,
        updated_by=SUPERADMIN_ID,
        created_at=datetime(year, 12, 31, 12, 0, tzinfo=timezone.utc),
        updated_at=datetime(year, 12, 31, 14, 0, tzinfo=timezone.utc),
        submission_status="approved",
    )

# ─────────────────────────────────────────────────────────────────────────────
# Data generators — по типу организации
# ─────────────────────────────────────────────────────────────────────────────

def gen_contingent_do(org_id: str, year: int, size: str) -> dict:
    """Детский сад: малыши по группам, нет студентов."""
    p = SIZE[size]
    total = rint(*p["children"])
    growth = 1 + (year - 2020) * random.uniform(0.01, 0.04)
    total = int(total * min(growth, 1.2))
    by_grade = {str(i): rint(int(total * 0.08), int(total * 0.25)) for i in range(1, 6)}
    by_specialty = {}
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        total_count=total, new_enrolled=int(total * 0.25), withdrawn=int(total * 0.05),
        bachelor_count=None, master_count=None, phd_count=None,
        full_time_count=total, distance_count=0,
        budget_count=int(total * 0.60), paid_count=int(total * 0.40),
        kz_lang_count=int(total * 0.65), ru_lang_count=int(total * 0.30),
        en_lang_count=int(total * 0.03), other_lang_count=max(0, int(total * 0.02)),
        foreign_count=0,
        many_children_count=int(total * 0.20), low_income_count=int(total * 0.15),
        disabled_count=int(total * 0.02), orphan_count=int(total * 0.01), oop_count=int(total * 0.05),
        privileged_share=rnd(30, 45),
        boarding_school_count=0, absences_count=rint(5, 50),
        by_grade_json=by_grade, by_specialty_json=by_specialty, prize_winners_json=[],
        **base_audit(year),
    )

def gen_contingent_dopo(org_id: str, year: int, size: str) -> dict:
    """Дополнительное образование: записавшиеся в кружки."""
    p = SIZE[size]
    total = rint(*p["children"]) * 2  # охват шире
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        total_count=total, new_enrolled=int(total * 0.35), withdrawn=int(total * 0.10),
        bachelor_count=None, master_count=None, phd_count=None,
        full_time_count=total, distance_count=0,
        budget_count=int(total * 0.70), paid_count=int(total * 0.30),
        kz_lang_count=int(total * 0.60), ru_lang_count=int(total * 0.35),
        en_lang_count=int(total * 0.03), other_lang_count=max(0, int(total * 0.02)),
        foreign_count=0,
        many_children_count=int(total * 0.15), low_income_count=int(total * 0.10),
        disabled_count=int(total * 0.03), orphan_count=int(total * 0.02), oop_count=int(total * 0.04),
        privileged_share=rnd(25, 40),
        boarding_school_count=0, absences_count=rint(10, 100),
        by_grade_json={str(i): rint(int(total * 0.05), int(total * 0.30)) for i in range(1, 5)},
        by_specialty_json={}, prize_winners_json=[
            {"name": f"Уч-к {i}", "award": random.choice(["1 место","2 место","3 место"]),
             "competition": random.choice(["Региональная олимпиада","Республика","Международный"])}
            for i in range(rint(3, 12))
        ],
        **base_audit(year),
    )

def gen_contingent_so(org_id: str, year: int, size: str) -> dict:
    """Школа: ученики с 1 по 12 класс."""
    p = SIZE[size]
    total = rint(*p["children"]) * (6 if size == "elite" else 4)
    by_grade = {str(i): rint(int(total * 0.05), int(total * 0.12)) for i in range(1, 13)}
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        total_count=total, new_enrolled=int(total * 0.08), withdrawn=int(total * 0.02),
        bachelor_count=None, master_count=None, phd_count=None,
        full_time_count=int(total * 0.95), distance_count=int(total * 0.05),
        budget_count=int(total * 0.85), paid_count=int(total * 0.15),
        kz_lang_count=int(total * 0.65), ru_lang_count=int(total * 0.30),
        en_lang_count=int(total * 0.04), other_lang_count=max(0, int(total * 0.01)),
        foreign_count=rint(0, 20),
        many_children_count=int(total * 0.12), low_income_count=int(total * 0.08),
        disabled_count=int(total * 0.02), orphan_count=int(total * 0.01), oop_count=int(total * 0.03),
        privileged_share=rnd(20, 35),
        boarding_school_count=int(total * 0.03) if size in ("elite","large") else 0,
        absences_count=rint(20, 200),
        by_grade_json=by_grade,
        by_specialty_json={s: rint(10, 80) for s in random.sample(["естественные науки","математика","гуманитарные","ИКТ","спорт"], k=3)},
        prize_winners_json=[
            {"name": f"Ученик {i}", "award": random.choice(["золото","серебро","бронза"]),
             "competition": random.choice(["Олимпиада РК","Международная","Региональная"])}
            for i in range(rint(2, 15))
        ],
        **base_audit(year),
    )

def gen_contingent_tippo(org_id: str, year: int, size: str) -> dict:
    """Колледж: студенты по специальностям."""
    p = SIZE[size]
    total = rint(*p["children"]) * 3
    SPECS = ["0101","0201","1201","1202","1301","1501","0401","0501","1101","0301"]
    by_spec = {s: rint(20, 250) for s in random.sample(SPECS, k=5)}
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        total_count=total, new_enrolled=int(total * 0.30), withdrawn=int(total * 0.05),
        bachelor_count=None, master_count=None, phd_count=None,
        full_time_count=int(total * 0.80), distance_count=int(total * 0.20),
        budget_count=int(total * 0.65), paid_count=int(total * 0.35),
        kz_lang_count=int(total * 0.60), ru_lang_count=int(total * 0.35),
        en_lang_count=int(total * 0.03), other_lang_count=max(0, int(total * 0.02)),
        foreign_count=rint(0, 50),
        many_children_count=int(total * 0.10), low_income_count=int(total * 0.12),
        disabled_count=int(total * 0.03), orphan_count=int(total * 0.02), oop_count=int(total * 0.05),
        privileged_share=rnd(25, 40),
        boarding_school_count=int(total * 0.15),
        absences_count=rint(30, 300),
        by_grade_json={str(i): rint(int(total * 0.15), int(total * 0.35)) for i in range(1, 4)},
        by_specialty_json=by_spec,
        prize_winners_json=[
            {"name": f"Студент {i}", "award": random.choice(["1 место","2 место"]),
             "competition": random.choice(["Олимпиада WorldSkills","Национальный чемпионат","Региональный"])}
            for i in range(rint(1, 8))
        ],
        **base_audit(year),
    )

def gen_contingent_obsh(org_id: str, year: int, size: str) -> dict:
    """Общежитие: количество проживающих."""
    p = SIZE[size]
    total = rint(100, 1000) if size == "large" else rint(50, 400)
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        total_count=total, new_enrolled=int(total * 0.40), withdrawn=int(total * 0.35),
        bachelor_count=int(total * 0.70), master_count=int(total * 0.20),
        phd_count=int(total * 0.05), full_time_count=total, distance_count=0,
        budget_count=int(total * 0.55), paid_count=int(total * 0.45),
        kz_lang_count=int(total * 0.55), ru_lang_count=int(total * 0.35),
        en_lang_count=int(total * 0.07), other_lang_count=max(0, int(total * 0.03)),
        foreign_count=int(total * 0.05),
        many_children_count=0, low_income_count=int(total * 0.10),
        disabled_count=int(total * 0.02), orphan_count=int(total * 0.03), oop_count=0,
        privileged_share=rnd(10, 20),
        boarding_school_count=0, absences_count=0,
        by_grade_json={}, by_specialty_json={}, prize_winners_json=[],
        **base_audit(year),
    )


def gen_finance_do(org_id: str, year: int, size: str) -> dict:
    """ДО: небольшой бюджет, коммунальные, питание, зарплата."""
    p = SIZE[size]
    annual = Decimal(rint(*p["budget_m"])) * Decimal("1000")
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year, period_month=None,
        annual_budget=annual,
        state_order_volume=annual * rnd(0.60, 0.80),
        extra_budget_income=annual * rnd(0.10, 0.20),
        per_capita_norm=rnd(120000, 350000),
        state_order_start_date=date(year, 1, 1),
        state_order_end_date=date(year, 12, 31),
        state_order_planned_amount=annual * rnd(0.58, 0.82),
        vouchers_issued=rint(0, 50),
        payments_to_suppliers=annual * rnd(0.05, 0.12),
        violations_info=None, return_notification_amount=annual * rnd(0.001, 0.003), return_reason=None,
        expenses_payroll=annual * rnd(0.50, 0.62),
        expenses_utilities=annual * rnd(0.10, 0.16),
        expenses_antiterror=annual * rnd(0.005, 0.015),
        expenses_food=annual * rnd(0.12, 0.20),
        expenses_medical=annual * rnd(0.02, 0.05),
        expenses_retraining=annual * rnd(0.01, 0.03),
        expenses_olympiads=Decimal("0"),
        expenses_extra_education=annual * rnd(0.01, 0.03),
        expenses_special_equipment=annual * rnd(0.02, 0.06),
        expenses_transport=annual * rnd(0.01, 0.03),
        expenses_rnd=Decimal("0"),
        expenses_scholarships=Decimal("0"),
        expenses_boarding=Decimal("0"),
        circle_price_per_session=rnd(500, 2000),
        paid_services_price=rnd(10000, 50000),
        paid_vs_free_ratio=rnd(0.10, 0.30),
        budget_execution_report_url=f"https://edu.gov.kz/reports/{year}/{org_id}.pdf",
        payment_orders_count=rint(50, 400),
        financing_requests_count=rint(20, 150),
        funding_sources_json=[
            {"name": "Местный бюджет", "amount": float(annual * rnd(0.60, 0.80)), "share": float(rnd(60, 80))},
            {"name": "Родительская плата", "amount": float(annual * rnd(0.10, 0.20)), "share": float(rnd(10, 20))},
        ],
        **base_audit(year),
    )

def gen_finance_dopo(org_id: str, year: int, size: str) -> dict:
    """ДопО: кружки, секции — смешанное финансирование."""
    p = SIZE[size]
    annual = Decimal(rint(*p["budget_m"])) * Decimal("1000")
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year, period_month=None,
        annual_budget=annual,
        state_order_volume=annual * rnd(0.40, 0.65),
        extra_budget_income=annual * rnd(0.20, 0.40),
        per_capita_norm=rnd(80000, 200000),
        state_order_start_date=date(year, 1, 1),
        state_order_end_date=date(year, 12, 31),
        state_order_planned_amount=annual * rnd(0.38, 0.67),
        vouchers_issued=rint(0, 100),
        payments_to_suppliers=annual * rnd(0.03, 0.10),
        violations_info=None, return_notification_amount=annual * rnd(0.001, 0.003), return_reason=None,
        expenses_payroll=annual * rnd(0.45, 0.58),
        expenses_utilities=annual * rnd(0.08, 0.14),
        expenses_antiterror=annual * rnd(0.003, 0.01),
        expenses_food=annual * rnd(0.02, 0.06),
        expenses_medical=annual * rnd(0.01, 0.03),
        expenses_retraining=annual * rnd(0.01, 0.04),
        expenses_olympiads=annual * rnd(0.02, 0.06),
        expenses_extra_education=annual * rnd(0.03, 0.08),
        expenses_special_equipment=annual * rnd(0.04, 0.10),
        expenses_transport=annual * rnd(0.01, 0.04),
        expenses_rnd=Decimal("0"),
        expenses_scholarships=Decimal("0"),
        expenses_boarding=Decimal("0"),
        circle_price_per_session=rnd(1000, 4000),
        paid_services_price=rnd(5000, 40000),
        paid_vs_free_ratio=rnd(0.25, 0.55),
        budget_execution_report_url=f"https://edu.gov.kz/reports/{year}/{org_id}.pdf",
        payment_orders_count=rint(30, 250),
        financing_requests_count=rint(15, 100),
        funding_sources_json=[
            {"name": "Местный бюджет", "amount": float(annual * rnd(0.40, 0.65)), "share": float(rnd(40, 65))},
            {"name": "Платные услуги", "amount": float(annual * rnd(0.20, 0.40)), "share": float(rnd(20, 40))},
            {"name": "Спонсоры", "amount": float(annual * rnd(0.02, 0.08)), "share": float(rnd(2, 8))},
        ],
        **base_audit(year),
    )

def gen_finance_so(org_id: str, year: int, size: str) -> dict:
    """Школа: норматив на ученика × контингент."""
    p = SIZE[size]
    annual = Decimal(rint(*p["budget_m"])) * Decimal("1000") * Decimal("4")
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year, period_month=None,
        annual_budget=annual,
        state_order_volume=annual * rnd(0.75, 0.90),
        extra_budget_income=annual * rnd(0.05, 0.15),
        per_capita_norm=rnd(200000, 500000),
        state_order_start_date=date(year, 1, 1),
        state_order_end_date=date(year, 12, 31),
        state_order_planned_amount=annual * rnd(0.73, 0.92),
        vouchers_issued=rint(0, 200),
        payments_to_suppliers=annual * rnd(0.05, 0.12),
        violations_info=None, return_notification_amount=annual * rnd(0.001, 0.004), return_reason=None,
        expenses_payroll=annual * rnd(0.52, 0.65),
        expenses_utilities=annual * rnd(0.08, 0.14),
        expenses_antiterror=annual * rnd(0.005, 0.015),
        expenses_food=annual * rnd(0.06, 0.12),
        expenses_medical=annual * rnd(0.01, 0.03),
        expenses_retraining=annual * rnd(0.01, 0.03),
        expenses_olympiads=annual * rnd(0.01, 0.04),
        expenses_extra_education=annual * rnd(0.02, 0.05),
        expenses_special_equipment=annual * rnd(0.02, 0.08),
        expenses_transport=annual * rnd(0.01, 0.04),
        expenses_rnd=Decimal("0"),
        expenses_scholarships=Decimal("0"),
        expenses_boarding=annual * rnd(0.01, 0.04) if size in ("elite","large") else Decimal("0"),
        circle_price_per_session=rnd(800, 3000),
        paid_services_price=rnd(10000, 80000),
        paid_vs_free_ratio=rnd(0.05, 0.20),
        budget_execution_report_url=f"https://edu.gov.kz/reports/{year}/{org_id}.pdf",
        payment_orders_count=rint(80, 600),
        financing_requests_count=rint(30, 200),
        funding_sources_json=[
            {"name": "Республиканский бюджет", "amount": float(annual * rnd(0.50, 0.70)), "share": float(rnd(50, 70))},
            {"name": "Местный бюджет", "amount": float(annual * rnd(0.20, 0.35)), "share": float(rnd(20, 35))},
            {"name": "Внебюджетные", "amount": float(annual * rnd(0.05, 0.15)), "share": float(rnd(5, 15))},
        ],
        **base_audit(year),
    )

def gen_finance_tippo(org_id: str, year: int, size: str) -> dict:
    """Колледж: госзаказ + внебюджет."""
    p = SIZE[size]
    annual = Decimal(rint(*p["budget_m"])) * Decimal("1000") * Decimal("2")
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year, period_month=None,
        annual_budget=annual,
        state_order_volume=annual * rnd(0.55, 0.75),
        extra_budget_income=annual * rnd(0.15, 0.30),
        per_capita_norm=rnd(250000, 600000),
        state_order_start_date=date(year, 1, 1),
        state_order_end_date=date(year, 12, 31),
        state_order_planned_amount=annual * rnd(0.53, 0.77),
        vouchers_issued=rint(50, 300),
        payments_to_suppliers=annual * rnd(0.05, 0.12),
        violations_info=None, return_notification_amount=annual * rnd(0.001, 0.004), return_reason=None,
        expenses_payroll=annual * rnd(0.42, 0.55),
        expenses_utilities=annual * rnd(0.07, 0.13),
        expenses_antiterror=annual * rnd(0.004, 0.012),
        expenses_food=annual * rnd(0.05, 0.10),
        expenses_medical=annual * rnd(0.01, 0.03),
        expenses_retraining=annual * rnd(0.01, 0.04),
        expenses_olympiads=annual * rnd(0.005, 0.02),
        expenses_extra_education=annual * rnd(0.01, 0.04),
        expenses_special_equipment=annual * rnd(0.04, 0.10),
        expenses_transport=annual * rnd(0.01, 0.04),
        expenses_rnd=annual * rnd(0.01, 0.04),
        expenses_scholarships=annual * rnd(0.02, 0.06),
        expenses_boarding=annual * rnd(0.03, 0.08),
        circle_price_per_session=rnd(1500, 5000),
        paid_services_price=rnd(30000, 150000),
        paid_vs_free_ratio=rnd(0.20, 0.45),
        budget_execution_report_url=f"https://edu.gov.kz/reports/{year}/{org_id}.pdf",
        payment_orders_count=rint(100, 700),
        financing_requests_count=rint(40, 250),
        funding_sources_json=[
            {"name": "Госзаказ (субсидии)", "amount": float(annual * rnd(0.55, 0.75)), "share": float(rnd(55, 75))},
            {"name": "Платная форма обучения", "amount": float(annual * rnd(0.15, 0.30)), "share": float(rnd(15, 30))},
            {"name": "Гранты и проекты", "amount": float(annual * rnd(0.02, 0.08)), "share": float(rnd(2, 8))},
        ],
        **base_audit(year),
    )

def gen_finance_obsh(org_id: str, year: int, size: str) -> dict:
    """Общежитие: коммунальные, питание, капремонт."""
    annual = Decimal(rint(500, 3000) if size == "large" else rint(150, 800)) * Decimal("1000000")
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year, period_month=None,
        annual_budget=annual,
        state_order_volume=annual * rnd(0.30, 0.55),
        extra_budget_income=annual * rnd(0.35, 0.55),
        per_capita_norm=rnd(80000, 200000),
        state_order_start_date=date(year, 1, 1),
        state_order_end_date=date(year, 12, 31),
        state_order_planned_amount=annual * rnd(0.28, 0.57),
        vouchers_issued=0,
        payments_to_suppliers=annual * rnd(0.08, 0.20),
        violations_info=None, return_notification_amount=Decimal("0"), return_reason=None,
        expenses_payroll=annual * rnd(0.30, 0.45),
        expenses_utilities=annual * rnd(0.20, 0.35),
        expenses_antiterror=annual * rnd(0.005, 0.015),
        expenses_food=annual * rnd(0.10, 0.20),
        expenses_medical=annual * rnd(0.01, 0.03),
        expenses_retraining=annual * rnd(0.005, 0.02),
        expenses_olympiads=Decimal("0"),
        expenses_extra_education=Decimal("0"),
        expenses_special_equipment=annual * rnd(0.03, 0.10),
        expenses_transport=annual * rnd(0.01, 0.03),
        expenses_rnd=Decimal("0"),
        expenses_scholarships=Decimal("0"),
        expenses_boarding=annual * rnd(0.10, 0.20),
        circle_price_per_session=Decimal("0"),
        paid_services_price=rnd(15000, 80000),
        paid_vs_free_ratio=rnd(0.40, 0.70),
        budget_execution_report_url=f"https://edu.gov.kz/reports/{year}/{org_id}.pdf",
        payment_orders_count=rint(40, 300),
        financing_requests_count=rint(15, 100),
        funding_sources_json=[
            {"name": "Плата за проживание", "amount": float(annual * rnd(0.35, 0.55)), "share": float(rnd(35, 55))},
            {"name": "Субсидии ВУЗа/МОН", "amount": float(annual * rnd(0.30, 0.50)), "share": float(rnd(30, 50))},
        ],
        **base_audit(year),
    )

def gen_finance_gons(org_id: str, year: int, size: str) -> dict:
    """ГОНС: накопительные вклады, государственная премия, объём системы."""
    annual = Decimal(rint(50000, 200000) if size in ("elite","large") else rint(10000, 60000)) * Decimal("1000000")
    deposits = annual * rnd(0.80, 1.20)
    state_premium = deposits * rnd(0.05, 0.075)  # ГОНС: 5-7.5% государственная премия
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year, period_month=None,
        annual_budget=annual,
        state_order_volume=state_premium,
        extra_budget_income=deposits * rnd(0.03, 0.06),
        per_capita_norm=rnd(500000, 2000000),
        state_order_start_date=date(year, 1, 1),
        state_order_end_date=date(year, 12, 31),
        state_order_planned_amount=state_premium * rnd(0.95, 1.05),
        vouchers_issued=rint(5000, 50000),
        payments_to_suppliers=annual * rnd(0.01, 0.05),
        violations_info=None, return_notification_amount=annual * rnd(0.0005, 0.002), return_reason=None,
        expenses_payroll=annual * rnd(0.02, 0.05),
        expenses_utilities=annual * rnd(0.001, 0.005),
        expenses_antiterror=Decimal("0"),
        expenses_food=Decimal("0"),
        expenses_medical=Decimal("0"),
        expenses_retraining=annual * rnd(0.001, 0.003),
        expenses_olympiads=Decimal("0"),
        expenses_extra_education=Decimal("0"),
        expenses_special_equipment=annual * rnd(0.005, 0.02),
        expenses_transport=annual * rnd(0.001, 0.003),
        expenses_rnd=Decimal("0"),
        expenses_scholarships=deposits * rnd(0.70, 0.90),  # выплаченные вклады при поступлении
        expenses_boarding=Decimal("0"),
        circle_price_per_session=Decimal("0"),
        paid_services_price=Decimal("0"),
        paid_vs_free_ratio=Decimal("0"),
        budget_execution_report_url=f"https://edu.gov.kz/reports/{year}/{org_id}-gons.pdf",
        payment_orders_count=rint(500, 10000),
        financing_requests_count=rint(100, 2000),
        funding_sources_json=[
            {"name": "Накопительные вклады граждан", "amount": float(deposits), "share": float(rnd(75, 85))},
            {"name": "Государственная премия ГОНС", "amount": float(state_premium), "share": float(rnd(5, 8))},
            {"name": "Инвестиционный доход", "amount": float(deposits * rnd(0.04, 0.07)), "share": float(rnd(4, 7))},
        ],
        **base_audit(year),
    )


def gen_science_minimal(org_id: str, year: int, size: str) -> dict:
    """Наука для ТиППО/ДО/ДопО/СО: минимальные показатели."""
    scopus = rint(0, 15) if size in ("small","medium") else rint(5, 30)
    wos = int(scopus * 0.5)
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        period_year=year,
        hirsch_index_avg=rnd(0, 2),
        hirsch_index_max=rnd(0, 3),
        publications_scopus=scopus,
        publications_wos=wos,
        publications_q1=int(wos * 0.1),
        publications_q2=int(wos * 0.2),
        publications_q3=int(wos * 0.3),
        publications_q4=max(0, wos - int(wos * 0.6)),
        grants_json=[],
        student_projects_json=[
            {"title": f"Проект «{random.choice(DIRECTIONS)}»", "stage": "идея",
             "funding": float(rnd(100000, 500000)), "participants": rint(2, 10)}
            for _ in range(rint(0, 3))
        ],
        **base_audit(year),
    )

def gen_graduates_so(org_id: str, year: int, size: str) -> dict:
    """Выпускники школы: куда поступают после 11 класса."""
    p = SIZE[size]
    total = rint(50, 300) if size in ("elite","large") else rint(20, 100)
    to_tippo = int(total * random.uniform(0.30, 0.45))
    to_vipo = int(total * random.uniform(0.35, 0.55))
    to_top_vipo = int(to_vipo * random.uniform(0.05, 0.20))
    not_enrolled = total - to_tippo - to_vipo
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        graduation_year=year,
        graduates_total=total,
        to_tippo_count=to_tippo,
        to_vipo_count=to_vipo,
        to_top_vipo_count=to_top_vipo,
        not_enrolled_count=max(0, not_enrolled),
        final_attestation_avg_score=rnd(3.5, 4.8) if size in ("elite","large") else rnd(3.0, 4.3),
        final_attestation_pass_pct=rnd(88, 100) if size in ("elite","large") else rnd(78, 98),
        employed_6m_pct=rnd(0.02, 0.10),  # только те, кто сразу работает
        employed_12m_pct=rnd(0.05, 0.15),
        employed_36m_pct=rnd(0.15, 0.30),
        employed_60m_pct=rnd(0.20, 0.40),
        avg_salary_by_specialty_json={},
        achievements_json=[
            {"type": "award", "name": f"Победитель олимпиады по {random.choice(['математике','физике','химии'])}", "year": year}
            for _ in range(rint(1, 10))
        ],
        legal_entities_participation_json={"count": 0},
        taxes_paid_json={"total_kzt": 0, "payers_count": 0},
        survey_results_json={"satisfied_pct": float(rnd(70, 95)), "respondents": rint(50, 300)},
        employer_partners_json=[],
        grant_workback_amount=None,
        **base_audit(year),
    )

def gen_graduates_tippo(org_id: str, year: int, size: str) -> dict:
    """Выпускники колледжа: трудоустройство + продолжение обучения."""
    total = rint(80, 400) if size in ("large","elite") else rint(30, 120)
    to_tippo = int(total * random.uniform(0.05, 0.10))
    to_vipo = int(total * random.uniform(0.10, 0.25))
    not_enrolled = int(total * random.uniform(0.05, 0.15))
    employed_6m = rnd(0.55, 0.82)
    employed_12m = min(Decimal("1.00"), employed_6m + rnd(0.05, 0.12))
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        graduation_year=year,
        graduates_total=total,
        to_tippo_count=to_tippo,
        to_vipo_count=to_vipo,
        to_top_vipo_count=int(to_vipo * 0.10),
        not_enrolled_count=max(0, not_enrolled),
        final_attestation_avg_score=rnd(3.2, 4.4),
        final_attestation_pass_pct=rnd(80, 98),
        employed_6m_pct=employed_6m,
        employed_12m_pct=employed_12m,
        employed_36m_pct=min(Decimal("1.00"), employed_12m + rnd(0.03, 0.08)),
        employed_60m_pct=min(Decimal("1.00"), employed_12m + rnd(0.05, 0.12)),
        avg_salary_by_specialty_json={s: float(rnd(100000, 300000)) for s in random.sample(["1201","1202","0101","0201","1501"], k=3)},
        achievements_json=[{"type": "award", "name": "WorldSkills КЗ призёр", "year": year}] if random.random() > 0.5 else [],
        legal_entities_participation_json={"count": rint(0, 10), "employees": rint(0, 50)},
        taxes_paid_json={"total_kzt": float(rnd(500000, 10000000)), "payers_count": rint(10, 100)},
        survey_results_json={"satisfied_pct": float(rnd(60, 90)), "respondents": rint(30, 200), "nps_score": float(rnd(15, 55))},
        employer_partners_json=[
            {"name": f"ТОО «Предприятие-{i}»", "sector": random.choice(["Строительство","ИТ","Медицина","Сельское хоз-во"]),
             "hired_count": rint(3, 30)}
            for i in range(rint(2, 6))
        ],
        grant_workback_amount=None,
        **base_audit(year),
    )

def gen_education_do(org_id: str, year: int, size: str) -> dict:
    """ДО: программы развития, кружки, родительский опрос."""
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        mandatory_programs_count=rint(3, 8),
        optional_programs_count=rint(1, 5),
        international_programs_count=0,
        has_developing_environment=random.choice([True, True, False]),
        startup_projects_count=0,
        additional_programs_json=[
            {"name": random.choice(["Буратино","Зерде","Кенгуру","Мерейлі"]),
             "hours": rint(36, 72), "enrolled": rint(10, 50), "certified_pct": float(rnd(80, 100))}
            for _ in range(rint(2, 6))
        ],
        circles_sections_json=[
            {"name": random.choice(["Рисование","Лепка","Музыка","Хореография","Шахматы"]),
             "type": "творчество", "participants": rint(10, 40), "price_per_session": float(rnd(500, 1500))}
            for _ in range(rint(3, 10))
        ],
        olympiad_participation_json=[],
        parent_survey_results_json={"satisfaction_pct": float(rnd(70, 95)), "respondents": rint(30, 200), "issues": []},
        academic_mobility_json={},
        academic_performance_json={
            "readiness_pct": float(rnd(78, 98)),
            "cognitive_develop_pct": float(rnd(70, 95)),
            "year": year,
        },
        practice_partners_json=[],
        **base_audit(year),
    )

def gen_education_dopo(org_id: str, year: int, size: str) -> dict:
    """ДопО: кружки, олимпиады, достижения."""
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        mandatory_programs_count=rint(1, 5),
        optional_programs_count=rint(5, 25),
        international_programs_count=rint(0, 3),
        has_developing_environment=True,
        startup_projects_count=rint(0, 5),
        additional_programs_json=[
            {"name": f"Программа «{random.choice(DIRECTIONS)}»", "hours": rint(36, 144),
             "enrolled": rint(15, 100), "certified_pct": float(rnd(70, 100))}
            for _ in range(rint(3, 12))
        ],
        circles_sections_json=[
            {"name": f"Секция/кружок {i}", "type": random.choice(["спорт","творчество","наука","ИКТ"]),
             "participants": rint(10, 60), "price_per_session": float(rnd(800, 3500))}
            for i in range(rint(5, 25))
        ],
        olympiad_participation_json=[
            {"name": f"Олимпиада по {random.choice(DIRECTIONS)}", "level": random.choice(["вуз","регион","республика","международный"]),
             "participants": rint(3, 30), "winners": rint(1, 8)}
            for _ in range(rint(3, 15))
        ],
        parent_survey_results_json={"satisfaction_pct": float(rnd(65, 92)), "respondents": rint(50, 500), "issues": []},
        academic_mobility_json={},
        academic_performance_json={},
        practice_partners_json=[],
        **base_audit(year),
    )

def gen_education_so(org_id: str, year: int, size: str) -> dict:
    """Школа: учебные программы, олимпиады, академическая успеваемость."""
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        mandatory_programs_count=rint(8, 20),
        optional_programs_count=rint(3, 15),
        international_programs_count=rint(0, 3) if size in ("elite","large") else 0,
        has_developing_environment=random.choice([True, True, False]),
        startup_projects_count=rint(0, 8),
        additional_programs_json=[
            {"name": f"Профиль «{random.choice(DIRECTIONS)}»", "hours": rint(72, 204),
             "enrolled": rint(20, 200), "certified_pct": float(rnd(75, 100))}
            for _ in range(rint(2, 8))
        ],
        circles_sections_json=[
            {"name": f"Кружок {i}", "type": random.choice(["спорт","творчество","наука","ИКТ"]),
             "participants": rint(8, 50), "price_per_session": float(rnd(0, 2000))}
            for i in range(rint(5, 20))
        ],
        olympiad_participation_json=[
            {"name": f"Олимпиада по {random.choice(['математике','физике','химии','истории','информатике'])}",
             "level": random.choice(["школьный","районный","областной","республиканский","международный"]),
             "participants": rint(5, 50), "winners": rint(0, 10)}
            for _ in range(rint(3, 15))
        ],
        parent_survey_results_json={"satisfaction_pct": float(rnd(65, 95)), "respondents": rint(100, 800), "issues": []},
        academic_mobility_json={"exchange_students": rint(0, 20)} if size in ("elite","large") else {},
        academic_performance_json={
            "gpa_avg": float(rnd(3.5, 4.8) if size in ("elite","large") else rnd(3.0, 4.3)),
            "distinction_pct": float(rnd(15, 45) if size in ("elite","large") else rnd(8, 25)),
            "fail_pct": float(rnd(0.5, 5)),
            "year": year,
        },
        practice_partners_json=[],
        **base_audit(year),
    )

def gen_education_tippo(org_id: str, year: int, size: str) -> dict:
    """ТиППО: производственная практика, партнёры-работодатели."""
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        mandatory_programs_count=rint(5, 20),
        optional_programs_count=rint(2, 10),
        international_programs_count=rint(0, 2),
        has_developing_environment=random.choice([True, False]),
        startup_projects_count=rint(0, 5),
        additional_programs_json=[
            {"name": f"Программа повышения квалификации «{random.choice(DIRECTIONS)}»",
             "hours": rint(72, 240), "enrolled": rint(15, 80), "certified_pct": float(rnd(80, 100))}
            for _ in range(rint(2, 6))
        ],
        circles_sections_json=[
            {"name": f"Секция {i}", "type": random.choice(["спорт","творчество","проф.навыки"]),
             "participants": rint(10, 40), "price_per_session": float(rnd(0, 2500))}
            for i in range(rint(3, 12))
        ],
        olympiad_participation_json=[
            {"name": "WorldSkills Kazakhstan", "level": "республика",
             "participants": rint(3, 30), "winners": rint(0, 5)}
            for _ in range(rint(1, 4))
        ],
        parent_survey_results_json={"satisfaction_pct": float(rnd(60, 88)), "respondents": rint(30, 300)},
        academic_mobility_json={"outbound": rint(0, 20), "inbound": rint(0, 10)},
        academic_performance_json={
            "gpa_avg": float(rnd(3.0, 4.2)),
            "distinction_pct": float(rnd(10, 30)),
            "fail_pct": float(rnd(1, 8)),
            "year": year,
        },
        practice_partners_json=[
            {"name": f"ТОО «Партнёр-{i}»", "sector": random.choice(["Строительство","ИТ","Медицина","Промышленность"]),
             "students_count": rint(10, 60)}
            for i in range(rint(3, 10))
        ],
        **base_audit(year),
    )

def gen_education_obsh(org_id: str, year: int, size: str) -> dict:
    """Общежитие: минимальные образовательные данные (не профильное)."""
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        mandatory_programs_count=0, optional_programs_count=rint(1, 5),
        international_programs_count=0, has_developing_environment=False,
        startup_projects_count=0,
        additional_programs_json=[
            {"name": "Программа адаптации первокурсников", "hours": 36, "enrolled": rint(50, 200), "certified_pct": 100.0}
        ],
        circles_sections_json=[
            {"name": random.choice(["Спортзал","Шахматный клуб","Библиотека"]),
             "type": "досуг", "participants": rint(10, 80), "price_per_session": 0.0}
            for _ in range(rint(1, 4))
        ],
        olympiad_participation_json=[],
        parent_survey_results_json={},
        academic_mobility_json={},
        academic_performance_json={},
        practice_partners_json=[],
        **base_audit(year),
    )

def gen_education_gons(org_id: str, year: int, size: str) -> dict:
    """ГОНС: обучающие мероприятия для вкладчиков."""
    return dict(
        org_id=org_id, source_id=SOURCE_ID,
        snapshot_date=date(year, 12, 31),
        mandatory_programs_count=rint(1, 3),
        optional_programs_count=rint(2, 8),
        international_programs_count=0, has_developing_environment=False,
        startup_projects_count=0,
        additional_programs_json=[
            {"name": "Финансовая грамотность для вкладчиков", "hours": 8,
             "enrolled": rint(500, 5000), "certified_pct": float(rnd(80, 100))}
        ],
        circles_sections_json=[],
        olympiad_participation_json=[],
        parent_survey_results_json={"satisfaction_pct": float(rnd(70, 90)), "respondents": rint(100, 2000)},
        academic_mobility_json={},
        academic_performance_json={},
        practice_partners_json=[],
        **base_audit(year),
    )

# ─────────────────────────────────────────────────────────────────────────────
# Роутер: выбирает нужный генератор по типу орг.
# ─────────────────────────────────────────────────────────────────────────────

CONTINGENT_GEN = {
    "ДО": gen_contingent_do, "ДопО": gen_contingent_dopo,
    "СО": gen_contingent_so, "ТиППО": gen_contingent_tippo,
    "Общ-е": gen_contingent_obsh,
}
FINANCE_GEN = {
    "ДО": gen_finance_do, "ДопО": gen_finance_dopo,
    "СО": gen_finance_so, "ТиППО": gen_finance_tippo,
    "Общ-е": gen_finance_obsh, "ГОНС": gen_finance_gons,
}
GRADUATES_GEN = {
    "СО": gen_graduates_so, "ТиППО": gen_graduates_tippo,
}
EDUCATION_GEN = {
    "ДО": gen_education_do, "ДопО": gen_education_dopo,
    "СО": gen_education_so, "ТиППО": gen_education_tippo,
    "Общ-е": gen_education_obsh, "ГОНС": gen_education_gons,
}

# ─────────────────────────────────────────────────────────────────────────────
# DB helpers — INSERT
# ─────────────────────────────────────────────────────────────────────────────

async def insert_org(session: AsyncSession, o: dict) -> str:
    r = await session.execute(text("""
        INSERT INTO organizations (name_ru, bin, org_type_id, ownership_form_id, region_id, status)
        VALUES (:name_ru, :bin, :org_type_id, :ownership_form_id, :region_id, 'active')
        ON CONFLICT (bin) DO UPDATE SET
            name_ru = EXCLUDED.name_ru,
            org_type_id = EXCLUDED.org_type_id,
            status = 'active'
        RETURNING id
    """), o)
    return str(r.scalar())


async def ins_contingent(s: AsyncSession, d: dict) -> None:
    p = prep(d, "by_grade_json", "by_specialty_json", "prize_winners_json")
    await s.execute(text("""
        INSERT INTO contingent_snapshots (
            org_id, source_id, snapshot_date, total_count, new_enrolled, withdrawn,
            bachelor_count, master_count, phd_count, full_time_count, distance_count,
            budget_count, paid_count, kz_lang_count, ru_lang_count, en_lang_count,
            other_lang_count, foreign_count, many_children_count, low_income_count,
            disabled_count, orphan_count, oop_count, privileged_share,
            boarding_school_count, absences_count,
            by_grade_json, by_specialty_json, prize_winners_json,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :snapshot_date, :total_count, :new_enrolled, :withdrawn,
            :bachelor_count, :master_count, :phd_count, :full_time_count, :distance_count,
            :budget_count, :paid_count, :kz_lang_count, :ru_lang_count, :en_lang_count,
            :other_lang_count, :foreign_count, :many_children_count, :low_income_count,
            :disabled_count, :orphan_count, :oop_count, :privileged_share,
            :boarding_school_count, :absences_count,
            cast(:by_grade_json as jsonb), cast(:by_specialty_json as jsonb),
            cast(:prize_winners_json as jsonb),
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        ) ON CONFLICT (org_id, snapshot_date) DO UPDATE SET
            total_count=EXCLUDED.total_count, new_enrolled=EXCLUDED.new_enrolled,
            withdrawn=EXCLUDED.withdrawn, budget_count=EXCLUDED.budget_count,
            paid_count=EXCLUDED.paid_count, submission_status=EXCLUDED.submission_status,
            updated_at=EXCLUDED.updated_at, deleted_at=NULL
    """), p)


async def ins_finance(s: AsyncSession, d: dict) -> None:
    p = prep(d, "funding_sources_json")
    await s.execute(text("""
        DELETE FROM finance_records
        WHERE org_id = :org_id AND period_year = :period_year AND period_month IS NULL
    """), {"org_id": p["org_id"], "period_year": p["period_year"]})
    await s.execute(text("""
        INSERT INTO finance_records (
            org_id, source_id, period_year, period_month, annual_budget, state_order_volume,
            extra_budget_income, per_capita_norm, state_order_start_date, state_order_end_date,
            state_order_planned_amount, vouchers_issued, payments_to_suppliers,
            violations_info, return_notification_amount, return_reason,
            expenses_payroll, expenses_utilities, expenses_antiterror, expenses_food,
            expenses_medical, expenses_retraining, expenses_olympiads, expenses_extra_education,
            expenses_special_equipment, expenses_transport, expenses_rnd,
            expenses_scholarships, expenses_boarding,
            circle_price_per_session, paid_services_price, paid_vs_free_ratio,
            budget_execution_report_url, payment_orders_count, financing_requests_count,
            funding_sources_json, submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :period_year, :period_month, :annual_budget, :state_order_volume,
            :extra_budget_income, :per_capita_norm, :state_order_start_date, :state_order_end_date,
            :state_order_planned_amount, :vouchers_issued, :payments_to_suppliers,
            :violations_info, :return_notification_amount, :return_reason,
            :expenses_payroll, :expenses_utilities, :expenses_antiterror, :expenses_food,
            :expenses_medical, :expenses_retraining, :expenses_olympiads, :expenses_extra_education,
            :expenses_special_equipment, :expenses_transport, :expenses_rnd,
            :expenses_scholarships, :expenses_boarding,
            :circle_price_per_session, :paid_services_price, :paid_vs_free_ratio,
            :budget_execution_report_url, :payment_orders_count, :financing_requests_count,
            cast(:funding_sources_json as jsonb),
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        )
    """), p)


async def ins_science(s: AsyncSession, d: dict) -> None:
    p = prep(d, "grants_json", "student_projects_json")
    await s.execute(text("""
        INSERT INTO science_activity (
            org_id, source_id, period_year, hirsch_index_avg, hirsch_index_max,
            publications_scopus, publications_wos, publications_q1, publications_q2,
            publications_q3, publications_q4, grants_json, student_projects_json,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :period_year, :hirsch_index_avg, :hirsch_index_max,
            :publications_scopus, :publications_wos, :publications_q1, :publications_q2,
            :publications_q3, :publications_q4,
            cast(:grants_json as jsonb), cast(:student_projects_json as jsonb),
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        ) ON CONFLICT (org_id, period_year) DO UPDATE SET
            publications_scopus=EXCLUDED.publications_scopus,
            publications_wos=EXCLUDED.publications_wos,
            submission_status=EXCLUDED.submission_status,
            updated_at=EXCLUDED.updated_at, deleted_at=NULL
    """), p)


async def ins_graduates(s: AsyncSession, d: dict) -> None:
    p = prep(d, "avg_salary_by_specialty_json", "achievements_json",
             "legal_entities_participation_json", "taxes_paid_json",
             "survey_results_json", "employer_partners_json")
    await s.execute(text("""
        INSERT INTO graduates_records (
            org_id, source_id, graduation_year, graduates_total, to_tippo_count,
            to_vipo_count, to_top_vipo_count, not_enrolled_count,
            final_attestation_avg_score, final_attestation_pass_pct,
            employed_6m_pct, employed_12m_pct, employed_36m_pct, employed_60m_pct,
            avg_salary_by_specialty_json, achievements_json,
            legal_entities_participation_json, taxes_paid_json,
            survey_results_json, employer_partners_json, grant_workback_amount,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :graduation_year, :graduates_total, :to_tippo_count,
            :to_vipo_count, :to_top_vipo_count, :not_enrolled_count,
            :final_attestation_avg_score, :final_attestation_pass_pct,
            :employed_6m_pct, :employed_12m_pct, :employed_36m_pct, :employed_60m_pct,
            cast(:avg_salary_by_specialty_json as jsonb), cast(:achievements_json as jsonb),
            cast(:legal_entities_participation_json as jsonb), cast(:taxes_paid_json as jsonb),
            cast(:survey_results_json as jsonb), cast(:employer_partners_json as jsonb),
            :grant_workback_amount,
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        ) ON CONFLICT (org_id, graduation_year) DO UPDATE SET
            graduates_total=EXCLUDED.graduates_total,
            employed_6m_pct=EXCLUDED.employed_6m_pct,
            submission_status=EXCLUDED.submission_status,
            updated_at=EXCLUDED.updated_at, deleted_at=NULL
    """), p)


async def ins_education(s: AsyncSession, d: dict) -> None:
    p = prep(d, "additional_programs_json", "circles_sections_json",
             "olympiad_participation_json", "parent_survey_results_json",
             "academic_mobility_json", "academic_performance_json", "practice_partners_json")
    await s.execute(text("""
        INSERT INTO educational_process (
            org_id, source_id, snapshot_date, mandatory_programs_count,
            optional_programs_count, international_programs_count,
            has_developing_environment, startup_projects_count,
            additional_programs_json, circles_sections_json, olympiad_participation_json,
            parent_survey_results_json, academic_mobility_json,
            academic_performance_json, practice_partners_json,
            submission_status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            :org_id, :source_id, :snapshot_date, :mandatory_programs_count,
            :optional_programs_count, :international_programs_count,
            :has_developing_environment, :startup_projects_count,
            cast(:additional_programs_json as jsonb), cast(:circles_sections_json as jsonb),
            cast(:olympiad_participation_json as jsonb), cast(:parent_survey_results_json as jsonb),
            cast(:academic_mobility_json as jsonb), cast(:academic_performance_json as jsonb),
            cast(:practice_partners_json as jsonb),
            :submission_status, :created_by, :updated_by, :created_at, :updated_at
        ) ON CONFLICT (org_id, snapshot_date) DO UPDATE SET
            mandatory_programs_count=EXCLUDED.mandatory_programs_count,
            optional_programs_count=EXCLUDED.optional_programs_count,
            submission_status=EXCLUDED.submission_status,
            updated_at=EXCLUDED.updated_at, deleted_at=NULL
    """), p)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

async def main() -> int:
    random.seed(7)
    print("=" * 65)
    print("EDU Monitoring — Сид данных всех 7 подсистем образования")
    print("=" * 65)

    await init_db()

    org_type_stats: dict[str, int] = {}
    total_orgs = len(NEW_ORGS)
    done = 0

    async with AsyncWriteSession() as session:
        for o in NEW_ORGS:
            ot = o["org_type"]
            size = o["size"]
            ownership_id = OF[o["ownership"]]
            region_id = REG[o["region"]]

            # 1. Создаём / обновляем организацию
            org_id = await insert_org(session, {
                "name_ru": o["name_ru"],
                "bin": o["bin"],
                "org_type_id": OT[ot],
                "ownership_form_id": ownership_id,
                "region_id": region_id,
            })
            done += 1
            org_type_stats[ot] = org_type_stats.get(ot, 0) + 1
            print(f"  [{done:02d}/{total_orgs}] {o['name_ru'][:50]} ({ot}, {size}) → {org_id[:8]}...")

            # 2. Данные по годам
            for year in YEARS:
                try:
                    # Контингент — у всех кроме ГОНС
                    if ot in CONTINGENT_GEN:
                        await ins_contingent(session, CONTINGENT_GEN[ot](org_id, year, size))

                    # Финансы — у всех
                    await ins_finance(session, FINANCE_GEN[ot](org_id, year, size))

                    # Наука — у всех кроме ГОНС и Общ-е (минимальная)
                    if ot not in ("ГОНС", "Общ-е"):
                        await ins_science(session, gen_science_minimal(org_id, year, size))

                    # Выпускники — только СО и ТиППО
                    if ot in GRADUATES_GEN:
                        await ins_graduates(session, GRADUATES_GEN[ot](org_id, year, size))

                    # Образовательный процесс — у всех кроме ГОНС имеет смысл
                    if ot in EDUCATION_GEN:
                        await ins_education(session, EDUCATION_GEN[ot](org_id, year, size))

                except Exception as e:
                    print(f"\n    ❌ {year}: {e}")
                    await session.rollback()
                    return 1

            await session.commit()

    print("\n" + "=" * 65)
    print("✅  Результат:")
    print(f"   Новых организаций создано: {total_orgs}")
    print(f"   Лет данных: {len(YEARS)} (2020-2025)")
    print()
    for ot_code, cnt in sorted(org_type_stats.items()):
        ot_name = {1:"ДО",2:"ДопО",3:"СО",4:"ТиППО",5:"ВиПО",6:"Общ-е",7:"ГОНС"}.get(
            {"ДО":1,"ДопО":2,"СО":3,"ТиППО":4,"ВиПО":5,"Общ-е":6,"ГОНС":7}[ot_code], ot_code)
        print(f"   {ot_code:8s}: {cnt:2d} орг.")
    print("=" * 65)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
