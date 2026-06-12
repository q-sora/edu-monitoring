"""
api/v1/school_rating.py — API for school rating submissions.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text

from app.api.dependencies import (
    ReadDBSession, DBSession, 
    require_role, 
    TokenPayload, verify_token
)
from app.crud.registry import school_rating_crud
from app.schemas.school_rating import (
    SchoolRatingResponse
)

# 1. Main router for global rating and history
router = APIRouter(tags=["School Rating"])

@router.get("/rating/schools", summary="Общий рейтинг школ")
async def get_overall_school_rating(
    db: ReadDBSession,
    academic_year: Optional[int] = Query(None),
    region_id: Optional[int] = Query(None),
    ownership: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user=Depends(require_role("superadmin", "admin", "management", "data_entry")),
):
    """Returns a list of schools ranked by their total score."""
    where, params = ["srs.submission_status = 'approved'", "srs.deleted_at IS NULL"], {}
    
    if academic_year:
        where.append("srs.academic_year = :year")
        params["year"] = academic_year
    if region_id:
        where.append("o.region_id = :region")
        params["region"] = region_id
    if ownership:
        where.append("o.ownership_form = :own")
        params["own"] = ownership

    where_str = " AND ".join(where)
    
    query = f"""
        SELECT 
            srs.id,
            o.name_ru as school_name,
            r.name_ru as region_name,
            o.ownership_form,
            srs.academic_year,
            (srs.scores->>'total_score')::numeric as total_score,
            RANK() OVER (ORDER BY (srs.scores->>'total_score')::numeric DESC) as rank
        FROM school_rating_submissions srs
        JOIN organizations o ON srs.school_id = o.id
        LEFT JOIN regions r ON o.region_id = r.id
        WHERE {where_str}
        ORDER BY total_score DESC
        LIMIT :limit OFFSET :offset
    """
    
    rows = await db.execute(text(query), {**params, "limit": limit, "offset": offset})
    
    count_query = f"""
        SELECT COUNT(*) 
        FROM school_rating_submissions srs
        JOIN organizations o ON srs.school_id = o.id
        WHERE {where_str}
    """
    count_row = await db.execute(text(count_query), params)
    
    return {
        "items": [dict(r._mapping) for r in rows.fetchall()],
        "total": count_row.scalar()
    }

@router.get("/schools/{school_id}/rating/latest", response_model=SchoolRatingResponse)
async def get_latest_approved_rating(
    school_id: UUID,
    db: ReadDBSession,
    _token = Depends(verify_token)
):
    record = await school_rating_crud.get_latest_approved(db, school_id=school_id)
    if not record:
        raise HTTPException(status_code=404, detail="No approved rating found for this school")
    return record
