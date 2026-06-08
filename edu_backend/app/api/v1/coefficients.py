"""api/v1/coefficients.py — Endpoints системы коэффициентов оценки."""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies import (
    AuthenticatedUser,
    DBSession,
    ReadDBSession,
)
from app.crud import coefficients as crud
from app.schemas.coefficients import (
    CoefficientDefinitionRead,
    CoefficientRecordCreate,
    CoefficientRecordRead,
    CoefficientScoreRead,
    OrgRatingEntry,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Коэффициенты"])


# ─────────────────────────────────────────────────────────────────────────────
# Definitions
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/coefficients/definitions", response_model=list[CoefficientDefinitionRead])
async def list_definitions(
    education_level: Optional[str] = Query(None),
    principle: Optional[str] = Query(None),
    db: ReadDBSession = None,
    token: AuthenticatedUser = None,
):
    return await crud.get_definitions(db, education_level=education_level, principle=principle)


@router.get("/coefficients/definitions/{education_level}", response_model=list[CoefficientDefinitionRead])
async def list_definitions_by_level(
    education_level: str,
    db: ReadDBSession = None,
    token: AuthenticatedUser = None,
):
    return await crud.get_definitions(db, education_level=education_level)


# ─────────────────────────────────────────────────────────────────────────────
# Records
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/organisations/{org_id}/coefficients/{year}",
    response_model=list[CoefficientRecordRead],
)
async def get_org_coefficients(
    org_id: UUID,
    year: int,
    education_level: Optional[str] = Query(None),
    db: ReadDBSession = None,
    token: AuthenticatedUser = None,
):
    return await crud.get_org_records(db, org_id=org_id, year=year, education_level=education_level)


@router.post(
    "/organisations/{org_id}/coefficients",
    response_model=CoefficientRecordRead,
    status_code=status.HTTP_200_OK,
)
async def upsert_coefficient(
    org_id: UUID,
    data: CoefficientRecordCreate,
    db: DBSession = None,
    token: AuthenticatedUser = None,
):
    if data.org_id != org_id:
        raise HTTPException(status_code=400, detail="org_id в теле не совпадает с URL")
    try:
        return await crud.upsert_record(db, data=data, user_id=token.sub)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Scores
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/organisations/{org_id}/coefficients/{year}/scores",
    response_model=list[CoefficientScoreRead],
)
async def get_scores(
    org_id: UUID,
    year: int,
    db: ReadDBSession = None,
    token: AuthenticatedUser = None,
):
    return await crud.get_org_scores(db, org_id=org_id, year=year)


@router.post(
    "/organisations/{org_id}/coefficients/{year}/calculate",
    response_model=list[CoefficientScoreRead],
)
async def calculate_scores(
    org_id: UUID,
    year: int,
    db: DBSession = None,
    token: AuthenticatedUser = None,
):
    from sqlalchemy import text
    lvl_rows = (await db.execute(text("""
        SELECT DISTINCT d.education_level
        FROM coefficient_records r
        JOIN coefficient_definitions d ON d.id = r.coeff_def_id
        WHERE r.org_id = :org_id AND r.period_year = :year
    """), {"org_id": str(org_id), "year": year})).all()

    results = []
    for (lvl,) in lvl_rows:
        score = await crud.calculate_scores(db, org_id=org_id, year=year, education_level=lvl)
        results.append(score)
    return results


@router.post(
    "/organisations/{org_id}/coefficients/{year}/sync",
    status_code=status.HTTP_200_OK,
)
async def sync_coefficients(
    org_id: UUID,
    year: int,
    db: DBSession = None,
    token: AuthenticatedUser = None,
):
    """Синхронизировать коэффициенты из центрального каталога данных (education_data)."""
    count = await crud.auto_calculate_records(db, org_id=org_id, year=year, user_id=token.sub)
    return {"message": f"Синхронизировано {count} коэффициентов"}


# ─────────────────────────────────────────────────────────────────────────────
# Ratings / Comparison
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/coefficients/ratings/{year}", response_model=list[OrgRatingEntry])
async def get_ratings(
    year: int,
    education_level: Optional[str] = Query(None),
    region_id: Optional[int] = Query(None),
    db: ReadDBSession = None,
    token: AuthenticatedUser = None,
):
    return await crud.get_ratings(db, year=year, education_level=education_level, region_id=region_id)


@router.get("/coefficients/comparison/{year}", response_model=list[OrgRatingEntry])
async def get_comparison(
    year: int,
    education_level: Optional[str] = Query(None),
    region_id: Optional[int] = Query(None),
    db: ReadDBSession = None,
    token: AuthenticatedUser = None,
):
    return await crud.get_ratings(db, year=year, education_level=education_level, region_id=region_id)
