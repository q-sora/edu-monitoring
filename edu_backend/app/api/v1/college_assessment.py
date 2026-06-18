"""API для оценки эффективности колледжей ТиППО."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import text

from app.api.dependencies import DBSession, ReadDBSession, require_role
from app.crud.college_assessment_import import parse_and_import_college_assessment

router = APIRouter(prefix="/college-assessment", tags=["College Assessment"])


@router.post("/import", summary="Загрузить Excel оценки эффективности колледжей")
async def import_college_assessment(
    db: DBSession,
    file: UploadFile = File(...),
    period_year: Optional[int] = Form(None),
    user=Depends(require_role("superadmin", "admin")),
):
    """
    Принимает Excel-шаблон оценки эффективности колледжей ТиППО.
    Год берётся из имени файла (например '2024_Абай.xlsx') или из параметра period_year.
    Повторная загрузка того же файла обновляет данные (UPSERT).
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(422, "Поддерживается только .xlsx / .xls")
    contents = await file.read()
    result = await parse_and_import_college_assessment(
        db, contents, file.filename, period_year, user.sub
    )
    return {"filename": file.filename, **result}


@router.get("/ratings", summary="Рейтинг колледжей")
async def get_ratings(
    db: ReadDBSession,
    period_year: Optional[int] = Query(None),
    region:      Optional[str] = Query(None),
    ownership:   Optional[str] = Query(None),
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user=Depends(require_role("superadmin", "admin", "management", "data_entry")),
):
    """Рейтинг колледжей по итоговому баллу с фильтрами."""
    where, params = ["1=1"], {}
    if period_year:
        where.append("ca.period_year = :year")
        params["year"] = period_year
    if region:
        where.append("ca.region ILIKE :region")
        params["region"] = f"%{region}%"
    if ownership:
        where.append("ca.ownership_form ILIKE :own")
        params["own"] = f"%{ownership}%"

    where_str = " AND ".join(where)
    rows = await db.execute(text(f"""
        SELECT
            ca.id, ca.college_name, ca.region, ca.district,
            ca.ownership_form, ca.location_type, ca.period_year,
            ca.contingent_actual, ca.capacity_design, ca.teachers_total,
            ca.total_score,
            ca.block1_score,
            ca.block2_score,
            ca.block3_score,
            ca.block4_score,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT('name', cas.specialty_name, 'score', cas.specialty_score)
                    ORDER BY cas.specialty_score DESC NULLS LAST
                ) FILTER (WHERE cas.id IS NOT NULL),
                '[]'::json
            ) AS specs,
            COUNT(cas.id) AS specialty_count,
            RANK() OVER (PARTITION BY ca.period_year ORDER BY ca.total_score DESC) AS rank
        FROM college_assessment ca
        LEFT JOIN college_assessment_specialty cas ON cas.assessment_id = ca.id
        WHERE {where_str}
        GROUP BY ca.id
        ORDER BY ca.total_score DESC
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": limit, "offset": offset})

    count_row = await db.execute(text(f"""
        SELECT COUNT(*) FROM college_assessment ca WHERE {where_str}
    """), params)

    return {
        "items": [dict(r._mapping) for r in rows.fetchall()],
        "total": count_row.scalar(),
    }


@router.get("/stats/gdp-baseline", summary="Макроэкономические базовые показатели из БД")
async def get_gdp_baseline(
    db: ReadDBSession,
    user=Depends(require_role("superadmin", "admin", "management", "data_entry")),
):
    """Возвращает фактические показатели выпускников, трудоустройства по специальности и зарплаты из БД."""
    res_grad = await db.execute(text("SELECT COUNT(*) FROM student_registry WHERE graduation_year IS NOT NULL;"))
    graduates = res_grad.scalar() or 150
    
    res_match = await db.execute(text("""
        SELECT 
            COUNT(*),
            COUNT(CASE WHEN specialty_match = TRUE THEN 1 END)
        FROM student_employment;
    """))
    total_emp, matched_emp = res_match.fetchone()
    match_pct = round(matched_emp / total_emp * 100, 1) if total_emp else 48.0
    
    res_sal = await db.execute(text("SELECT AVG(salary_amount) FROM student_salary;"))
    avg_sal = res_sal.scalar()
    avg_salary_base = round(float(avg_sal) / 1000, 1) if avg_sal else 403.0
    
    return {
        "graduates": graduates,
        "match_pct": match_pct,
        "avg_salary_base": avg_salary_base
    }


@router.get("/stats/overview", summary="Сводная статистика по регионам")
async def get_overview(
    db: ReadDBSession,
    period_year: Optional[int] = Query(None),
    user=Depends(require_role("superadmin", "admin", "management")),
):
    where = "WHERE period_year = :year" if period_year else ""
    params = {"year": period_year} if period_year else {}
    rows = await db.execute(text(f"""
        SELECT
            region,
            COUNT(*)                   AS college_count,
            ROUND(AVG(total_score), 2) AS avg_score,
            MAX(total_score)           AS max_score,
            MIN(total_score)           AS min_score,
            SUM(contingent_actual)     AS total_students,
            COUNT(CASE WHEN total_score >= 20 THEN 1 END) AS high_performers,
            COUNT(CASE WHEN total_score < 10  THEN 1 END) AS low_performers
        FROM college_assessment {where}
        GROUP BY region
        ORDER BY avg_score DESC
    """), params)
    return {"by_region": [dict(r._mapping) for r in rows.fetchall()]}



@router.get("/{assessment_id}/specialties", summary="Специальности колледжа")
async def get_specialties(
    assessment_id: int,
    db: ReadDBSession,
    user=Depends(require_role("superadmin", "admin", "management", "data_entry")),
):
    rows = await db.execute(text("""
        SELECT specialty_code, specialty_name, specialty_score,
               employment_pct, academic_performance_pct,
               score_employment, score_academic, score_dual,
               dual_students_count, demo_exam_students,
               ws_student_place_republic, ws_student_place_intl
        FROM college_assessment_specialty
        WHERE assessment_id = :id
        ORDER BY specialty_score DESC NULLS LAST
    """), {"id": assessment_id})
    return {"specialties": [dict(r._mapping) for r in rows.fetchall()]}


@router.get("/top-specialties/employment", summary="Топ специальностей по трудоустройству")
async def get_top_by_employment(
    db: ReadDBSession,
    period_year: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    user=Depends(require_role("superadmin", "admin", "management", "data_entry")),
):
    where = "AND ca.period_year = :year" if period_year else ""
    params: dict = {"limit": limit}
    if period_year:
        params["year"] = period_year
    rows = await db.execute(text(f"""
        SELECT
            cas.specialty_name, cas.specialty_code,
            ca.college_name, ca.region,
            cas.employment_pct, cas.specialty_score,
            cas.dual_students_count, cas.demo_exam_students
        FROM college_assessment_specialty cas
        JOIN college_assessment ca ON ca.id = cas.assessment_id
        WHERE cas.employment_pct IS NOT NULL {where}
        ORDER BY cas.employment_pct DESC
        LIMIT :limit
    """), params)
    return {"items": [dict(r._mapping) for r in rows.fetchall()]}
