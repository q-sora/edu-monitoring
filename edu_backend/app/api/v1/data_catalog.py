"""API для справочника data_catalog."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text

from app.api.dependencies import DBSession, ReadDBSession, require_role
from app.crud.data_catalog_import import import_catalog

router = APIRouter(prefix="/data-catalog", tags=["Data Catalog"])


@router.post("/import")
async def import_data_catalog(
    db: DBSession,
    file: UploadFile = File(...),
    user=Depends(require_role("superadmin")),
):
    """Импорт каталога данных .xlsx. Только суперадмин."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(422, "Поддерживается только .xlsx / .xls")
    contents = await file.read()
    result = await import_catalog(db, contents)
    return {"filename": file.filename, **result}


@router.get("/levels")
async def get_levels(
    db: ReadDBSession,
    user=Depends(require_role("superadmin", "admin", "management", "data_entry")),
):
    """Список уровней образования с количеством полей."""
    result = await db.execute(text("""
        SELECT education_level,
               MIN(code) AS code,
               COUNT(*) AS total_fields,
               COUNT(DISTINCT section_slug) AS sections
        FROM data_catalog WHERE is_active = TRUE
        GROUP BY education_level
        ORDER BY MIN(sort_order)
    """))
    return {"levels": [dict(r._mapping) for r in result.fetchall()]}


@router.get("/sections/{education_level}")
async def get_sections(
    education_level: str,
    db: ReadDBSession,
    user=Depends(require_role("superadmin", "admin", "management", "data_entry")),
):
    """Список разделов для уровня образования."""
    result = await db.execute(text("""
        SELECT section_slug, section, COUNT(*) AS field_count
        FROM data_catalog
        WHERE education_level = :lvl AND is_active = TRUE
        GROUP BY section_slug, section
        ORDER BY section
    """), {"lvl": education_level})
    return {"sections": [dict(r._mapping) for r in result.fetchall()]}


@router.get("/fields/{education_level}/{section_slug}")
async def get_fields(
    education_level: str,
    section_slug: str,
    db: ReadDBSession,
    user=Depends(require_role("superadmin", "admin", "management", "data_entry")),
):
    """Поля раздела."""
    result = await db.execute(text("""
        SELECT id, field_name, field_slug, source, frequency, data_type_code
        FROM data_catalog
        WHERE education_level = :lvl AND section_slug = :sec AND is_active = TRUE
        ORDER BY sort_order, field_name
    """), {"lvl": education_level, "sec": section_slug})
    return {"fields": [dict(r._mapping) for r in result.fetchall()]}


@router.get("/stats")
async def catalog_stats(
    db: ReadDBSession,
    user=Depends(require_role("superadmin", "admin", "management")),
):
    """Сводка по каталогу: уровни × разделы × количество полей."""
    result = await db.execute(text("""
        SELECT education_level, section, COUNT(*) AS fields
        FROM data_catalog WHERE is_active = TRUE
        GROUP BY education_level, section
        ORDER BY education_level, fields DESC
    """))
    total = await db.execute(text(
        "SELECT COUNT(*) AS total FROM data_catalog WHERE is_active = TRUE"
    ))
    return {
        "total_fields": total.scalar(),
        "breakdown": [dict(r._mapping) for r in result.fetchall()],
    }
