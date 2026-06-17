"""
scripts/seed_data.py
─────────────────────────────────────────────────────────────────────────────
Seed script — populates reference tables and creates a sample ВиПО org.

Run:
    python -m scripts.seed_data
    # or:
    PYTHONPATH=. python scripts/seed_data.py

This is safe to run multiple times — all inserts use ON CONFLICT DO NOTHING.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import AsyncWriteSession, init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Seed data definitions
# ─────────────────────────────────────────────────────────────────────────────

ORG_TYPES = [
    {"id": 1, "code": "ДО",     "name_ru": "Дошкольное образование",                     "description": "Детские сады, мини-центры, ясли"},
    {"id": 2, "code": "ДопО",   "name_ru": "Дополнительное образование",                 "description": "Спортшколы, музыкальные, художественные школы"},
    {"id": 3, "code": "СО",     "name_ru": "Среднее образование",                        "description": "Школы, лицеи, гимназии, интернаты, лагеря"},
    {"id": 4, "code": "ТиППО",  "name_ru": "Техническое и профессиональное образование", "description": "Колледжи, профлицеи, ПТШ"},
    {"id": 5, "code": "ВиПО",   "name_ru": "Высшее и послевузовское образование",        "description": "Университеты, академии, институты"},
]

OWNERSHIP_FORMS = [
    {"id": 1, "code": "state",        "name_ru": "Государственная"},
    {"id": 2, "code": "private",      "name_ru": "Частная"},
    {"id": 3, "code": "ppp",          "name_ru": "Государственно-частное партнёрство"},
    {"id": 4, "code": "municipal",    "name_ru": "Коммунальная"},
    {"id": 5, "code": "national",     "name_ru": "Национальная"},
    {"id": 6, "code": "international","name_ru": "Международная"},
]

REGIONS = [
    {"id":  1, "code": "AKM", "name_ru": "Акмолинская область",               "type": "oblast"},
    {"id":  2, "code": "AKT", "name_ru": "Актюбинская область",               "type": "oblast"},
    {"id":  3, "code": "ALM", "name_ru": "Алматинская область",               "type": "oblast"},
    {"id":  4, "code": "ATY", "name_ru": "Атырауская область",                "type": "oblast"},
    {"id":  5, "code": "VKO", "name_ru": "Восточно-Казахстанская область",    "type": "oblast"},
    {"id":  6, "code": "ZHM", "name_ru": "Жамбылская область",               "type": "oblast"},
    {"id":  7, "code": "ZHT", "name_ru": "Жетісу область",                   "type": "oblast"},
    {"id":  8, "code": "ZKO", "name_ru": "Западно-Казахстанская область",    "type": "oblast"},
    {"id":  9, "code": "KAR", "name_ru": "Карагандинская область",           "type": "oblast"},
    {"id": 10, "code": "KOS", "name_ru": "Костанайская область",             "type": "oblast"},
    {"id": 11, "code": "KZO", "name_ru": "Кызылординская область",           "type": "oblast"},
    {"id": 12, "code": "MAN", "name_ru": "Мангистауская область",            "type": "oblast"},
    {"id": 13, "code": "PAV", "name_ru": "Павлодарская область",             "type": "oblast"},
    {"id": 14, "code": "SKO", "name_ru": "Северо-Казахстанская область",     "type": "oblast"},
    {"id": 15, "code": "TRK", "name_ru": "Туркестанская область",            "type": "oblast"},
    {"id": 16, "code": "ULT", "name_ru": "Ұлытау область",                   "type": "oblast"},
    {"id": 17, "code": "ALA", "name_ru": "г. Алматы",                        "type": "city"},
    {"id": 18, "code": "AST", "name_ru": "г. Астана",                        "type": "city"},
    {"id": 19, "code": "SHY", "name_ru": "г. Шымкент",                       "type": "city"},
]

DATA_SOURCES = [
    {"id":  1, "code": "НОБД",      "name_ru": "Национальная образовательная база данных",     "url": "https://nobd.edu.kz"},
    {"id":  2, "code": "ЕПВО",      "name_ru": "Единый реестр организаций высшего образования","url": "https://epvo.kz"},
    {"id":  3, "code": "eGov",      "name_ru": "Электронное правительство",                    "url": "https://egov.kz"},
    {"id":  4, "code": "elicense",  "name_ru": "Лицензирование",                              "url": "https://elicense.kz"},
    {"id":  5, "code": "АРРФР",     "name_ru": "Агентство по регулированию финрынка",         "url": None},
    {"id":  6, "code": "АО ФЦ ЕРД","name_ru": "АО Финансовый центр ЕРД",                     "url": None},
    {"id":  7, "code": "КОПД",      "name_ru": "Комитет охраны прав детей",                   "url": None},
    {"id":  8, "code": "МТСЗН",     "name_ru": "Министерство труда и соцзащиты населения",    "url": None},
    {"id":  9, "code": "Кунделик",  "name_ru": "ИС Кунделик",                                 "url": "https://kundelik.kz"},
    {"id": 10, "code": "Студом",    "name_ru": "ИС Студом",                                    "url": None},
    {"id": 11, "code": "ГБДФЛ",     "name_ru": "ГБД Физических лиц",                          "url": None},
    {"id": 12, "code": "ЕНПФ",      "name_ru": "Единый накопительный пенсионный фонд",         "url": None},
    {"id": 13, "code": "орг_данные","name_ru": "Данные самой организации",                     "url": None},
]

# Sample organisations for development / testing
SAMPLE_ORGS = [
    {
        "id":               "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bin":              "980540000419",
        "name_ru":          "Казахский национальный университет им. аль-Фараби",
        "org_type_id":      5,   # ВиПО
        "ownership_form_id": 1,  # Государственная
        "region_id":        17,  # г. Алматы
        "address_full":     "г. Алматы, пр. аль-Фараби, 71",
        "status":           "active",
        "vuz_status":       "Национальный",
    },
    {
        "id":               "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "bin":              "991041000237",
        "name_ru":          "КИМЭП",
        "org_type_id":      5,   # ВиПО
        "ownership_form_id": 2,  # Частная
        "region_id":        17,  # г. Алматы
        "address_full":     "г. Алматы, ул. Абая, 4",
        "status":           "active",
        "vuz_status":       "Частный",
    },
    {
        "id":               "cccccccc-cccc-cccc-cccc-cccccccccccc",
        "bin":              "050640010284",
        "name_ru":          "Назарбаев Университет",
        "org_type_id":      5,   # ВиПО
        "ownership_form_id": 5,  # Национальная
        "region_id":        18,  # г. Астана
        "address_full":     "г. Астана, пр. Кабанбай батыра, 53",
        "status":           "active",
        "vuz_status":       "Национальный",
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Seed functions
# ─────────────────────────────────────────────────────────────────────────────

async def _upsert(session, table: str, rows: list[dict], conflict_cols: list[str]) -> int:
    """Generic ON CONFLICT DO NOTHING upsert for reference data."""
    if not rows:
        return 0
    sql = text(
        f"INSERT INTO {table} ({', '.join(rows[0].keys())}) "
        f"VALUES ({', '.join(':' + k for k in rows[0].keys())}) "
        f"ON CONFLICT ({', '.join(conflict_cols)}) DO NOTHING"
    )
    count = 0
    for row in rows:
        result = await session.execute(sql, row)
        count += result.rowcount
    return count


async def seed_all() -> None:
    logger.info("Starting database seed...")
    await init_db()

    async with AsyncWriteSession() as session:
        async with session.begin():

            # ── Reference tables ──────────────────────────────────────────
            n = await _upsert(session, "org_types",      ORG_TYPES,      ["id"])
            logger.info("org_types:      %d rows inserted", n)

            n = await _upsert(session, "ownership_forms", OWNERSHIP_FORMS, ["id"])
            logger.info("ownership_forms: %d rows inserted", n)

            n = await _upsert(session, "regions",         REGIONS,        ["id"])
            logger.info("regions:         %d rows inserted", n)

            n = await _upsert(session, "data_sources",    DATA_SOURCES,   ["id"])
            logger.info("data_sources:    %d rows inserted", n)

            # ── Sample organisations ──────────────────────────────────────
            n = await _upsert(session, "organizations", SAMPLE_ORGS, ["id"])
            logger.info("organizations:   %d rows inserted", n)

    logger.info("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_all())
