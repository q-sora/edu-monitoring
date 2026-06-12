"""API для универсального импорта Excel по каталогу данных."""
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
import json

from app.api.dependencies import DBSession, require_role
from app.crud.universal_import import preview_excel, import_with_mapping

router = APIRouter(prefix="/universal-import", tags=["Universal Import"])


@router.post("/preview")
async def preview(
    db: DBSession,
    file: UploadFile = File(...),
    education_level: Optional[str] = Form(None),
    user=Depends(require_role("superadmin", "admin")),
):
    """Превью Excel-файла + автоматические предложения маппинга колонок."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(422, "Только .xlsx / .xls")
    contents = await file.read()
    return await preview_excel(contents, file.filename, db, education_level)


@router.post("/execute")
async def execute_import(
    db: DBSession,
    file: UploadFile = File(...),
    mappings_json: str = Form(...),
    period_year: int = Form(...),
    period_month: Optional[int] = Form(None),
    org_column: Optional[str] = Form(None),
    user=Depends(require_role("superadmin", "admin")),
):
    """Импорт по заданному маппингу колонок на поля каталога."""
    try:
        mappings = json.loads(mappings_json)
    except json.JSONDecodeError:
        raise HTTPException(422, "mappings_json — невалидный JSON")
    contents = await file.read()
    return await import_with_mapping(
        db, contents, file.filename, mappings,
        period_year, period_month, org_column, str(user.id),
    )
