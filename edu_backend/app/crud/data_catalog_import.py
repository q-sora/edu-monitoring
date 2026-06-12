"""Парсинг каталога данных .xlsx в таблицу data_catalog."""
from __future__ import annotations
import io
import re
import logging
from typing import Optional
import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

LEVEL_MAP = {
    "1ДО":         "do",
    "2ДопО":       "dopo",
    "3СО":         "so",
    "4ТиППО":      "tippo",
    "4ТиППо":      "tippo",
    "5ВиПО":       "vipo",
    "6Общ-е":      "obsh",
    "7ГОНС Кел-к": "gons",
}

SECTION_MAP = {
    "Общие сведения":                                    "general",
    "Контингент":                                        "contingent",
    "Группы":                                            "groups",
    "Педагогический состав и вспомогательный персонал":  "staff",
    "Финансы и бюджет":                                  "finance",
    "Оборудование и материалы":                          "equipment",
    "Инфраструктура":                                    "infrastructure",
    "Образовательный процесс":                           "education_process",
    "Медицинское обслуживание":                          "medical",
    "Цифровизация":                                      "digitalization",
    "Выпускники и экономический эффект":                 "graduates",
    "Мошенничество":                                     "fraud",
    "Научная деятельность":                              "science",
    "Международная деятельность":                        "international",
    "Общежития - общие сведения":                        "dormitory_general",
    "Мониторинг проживания в общежитиях":                "dormitory_monitoring",
    # Длинные разделы из файла — нормализуем вручную
    "Этапы рассмотрения заявлений поставщиков для \nразмещения госзаказа по обеспечению местами \nстудентов в общежитии": "goz_dormitory_stages",
}


def slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[-\s]+", "_", s)
    return s[:240]


def normalize_section(name: str) -> str:
    clean = (name or "").strip().replace("\n", " ")
    return SECTION_MAP.get(clean, slugify(clean) or "other")


async def import_catalog(db: AsyncSession, file_bytes: bytes) -> dict:
    """Идемпотентный импорт каталога: UPSERT по (level, section_slug, field_slug)."""
    df = pd.read_excel(io.BytesIO(file_bytes), header=0, dtype=str)

    # Переименовываем первые 6 колонок, остальные — extra_N
    cols = list(df.columns)
    rename = {}
    if len(cols) > 0: rename[cols[0]] = "code"
    if len(cols) > 1: rename[cols[1]] = "section_raw"
    if len(cols) > 2: rename[cols[2]] = "field_name"
    if len(cols) > 3: rename[cols[3]] = "source"
    if len(cols) > 4: rename[cols[4]] = "frequency"
    if len(cols) > 5: rename[cols[5]] = "data_type"
    df = df.rename(columns=rename)

    inserted = 0
    updated = 0
    skipped = 0
    by_level: dict[str, int] = {}

    for sort_order, (_, row) in enumerate(df.iterrows()):
        code = str(row.get("code", "")).strip() if pd.notna(row.get("code")) else None
        field_name = str(row.get("field_name", "")).strip() if pd.notna(row.get("field_name")) else None

        if not code or not field_name or code not in LEVEL_MAP:
            skipped += 1
            continue

        level = LEVEL_MAP[code]
        section_raw = str(row.get("section_raw", "")).strip() if pd.notna(row.get("section_raw")) else "Прочее"
        section_slug = normalize_section(section_raw)
        field_slug = slugify(field_name)[:240]

        try:
            await db.execute(text("SAVEPOINT sp_row"))
            result = await db.execute(text("""
                INSERT INTO data_catalog (
                    code, education_level, section, section_slug,
                    field_name, field_slug,
                    source, frequency, data_type_code,
                    sort_order, is_active
                ) VALUES (
                    :code, :level, :section, :section_slug,
                    :field_name, :field_slug,
                    :source, :frequency, :data_type,
                    :sort_order, TRUE
                )
                ON CONFLICT (education_level, section_slug, field_slug)
                DO UPDATE SET
                    field_name     = EXCLUDED.field_name,
                    source         = EXCLUDED.source,
                    frequency      = EXCLUDED.frequency,
                    data_type_code = EXCLUDED.data_type_code,
                    updated_at     = NOW()
                RETURNING (xmax = 0) AS was_inserted
            """), {
                "code":         code,
                "level":        level,
                "section":      section_raw,
                "section_slug": section_slug,
                "field_name":   field_name,
                "field_slug":   field_slug,
                "source":       str(row.get("source", "")).strip() or None,
                "frequency":    str(row.get("frequency", "")).strip() or None,
                "data_type":    str(row.get("data_type", "")).strip() or None,
                "sort_order":   sort_order,
            })
            await db.execute(text("RELEASE SAVEPOINT sp_row"))
            r = result.fetchone()
            if r and r.was_inserted:
                inserted += 1
            else:
                updated += 1
            by_level[level] = by_level.get(level, 0) + 1
        except Exception as e:
            await db.execute(text("ROLLBACK TO SAVEPOINT sp_row"))
            logger.warning("Catalog import row failed: %s | %s", field_name[:60], e)
            skipped += 1

    await db.commit()

    return {
        "inserted":        inserted,
        "updated":         updated,
        "skipped":         skipped,
        "by_level":        by_level,
        "total_processed": inserted + updated,
    }
