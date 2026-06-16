"""
api/v1/trajectory.py
─────────────────────────────────────────────────────────────────────────────
Траектория учащегося: CRUD по студентам + аналитические endpoints.

Endpoints:
    CRUD студентов:
        GET    /trajectory/students               — список по org_id + year
        POST   /trajectory/students               — создать одного студента
        POST   /trajectory/students/bulk          — массовый импорт
        GET    /trajectory/students/{iin}         — профиль студента (+ вложенные данные)
        PATCH  /trajectory/students/{iin}         — обновить базовые поля

    Дочерние данные:
        POST   /trajectory/students/{iin}/academic    — добавить GPA за семестр
        POST   /trajectory/students/{iin}/employment  — добавить запись о занятости
        POST   /trajectory/students/{iin}/salary      — добавить запись о зарплате

    Аналитика:
        GET    /trajectory/analytics/funnel       — воронка когорты
        GET    /trajectory/analytics/scatter      — scatter (ЕНТ → GPA)
        GET    /trajectory/analytics/patterns     — паттерн-карточки
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import DBSession, ReadDBSession, require_permission, verify_token
from app.models.trajectory import (
    StudentAcademic,
    StudentEmployment,
    StudentRegistry,
    StudentSalary,
)
from app.schemas.trajectory import (
    FunnelStep,
    PatternCard,
    SalaryPremium,
    ScatterPoint,
    StudentAcademicCreate,
    StudentAcademicRead,
    StudentBulkCreate,
    StudentBulkResult,
    StudentEmploymentCreate,
    StudentEmploymentRead,
    StudentRegistryCreate,
    StudentRegistryListResponse,
    StudentRegistryRead,
    StudentRegistryUpdate,
    StudentSalaryCreate,
    StudentSalaryRead,
    StudentTableRow,
    TrajectoryFunnelResponse,
    TrajectoryPatternsResponse,
    TrajectoryScatterResponse,
    TrajectoryTableResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trajectory", tags=["Траектория учащегося"])

_VIEW_PERM   = Depends(require_permission("data.view_all"))
_MANAGE_PERM = Depends(require_permission("admin"))


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _mask_iin(iin: str) -> str:
    """Маскирует ИИН: первые 8 цифр заменяются на *."""
    return f"****{iin[4:8]}****" if len(iin) == 12 else "****"


def _traj_label(ent: Optional[int], gpa1: Optional[float]) -> str:
    if ent is None or gpa1 is None:
        return "unknown"
    ent_band  = "excellent" if ent >= 100 else ("good" if ent >= 70 else "weak")
    gpa_band  = "excellent" if gpa1 >= 4.0 else ("good" if gpa1 >= 3.0 else "weak")
    if ent_band == gpa_band:
        return "stable"
    if ent_band == "excellent" and gpa_band != "excellent":
        return "faller"
    if ent_band == "weak" and gpa_band != "weak":
        return "riser"
    return "changed"


_ANALYTICS_SQL = """
WITH base AS (
    SELECT
        sr.iin,
        sr.ent_score,
        -- GPA 1-го года: среднее по 1-2 семестрам первого учебного года
        AVG(sa.gpa) FILTER (
            WHERE sa.academic_year = sr.enrollment_year
               OR (sr.enrollment_year IS NULL AND sa.semester_number <= 2)
        ) AS gpa_year1,
        -- GPA итоговый: среднее по всем семестрам
        AVG(sa.gpa) AS gpa_final,
        se.employment_status,
        se.specialty_match,
        -- средняя зарплата за первый год после выпуска
        (
            SELECT AVG(ss.salary_amount)
            FROM student_salary ss
            WHERE ss.iin = sr.iin
              AND ss.period_year = sr.graduation_year + 1
        ) AS avg_salary_tks
    FROM student_registry sr
    LEFT JOIN student_academic sa    ON sa.iin = sr.iin
    LEFT JOIN student_employment se  ON se.iin = sr.iin
         AND se.period_year = sr.graduation_year + 1
    WHERE sr.org_id      = CAST(:org_id AS uuid)
      AND sr.graduation_year = :graduation_year
      AND sr.deleted_at IS NULL
    GROUP BY sr.iin, sr.ent_score, sr.enrollment_year,
             sr.graduation_year, se.employment_status, se.specialty_match
)
SELECT
    COUNT(*)                                                              AS total,
    COUNT(*) FILTER (WHERE gpa_final >= 2.5)                            AS graduated,
    COUNT(*) FILTER (WHERE employment_status = 'employed')              AS employed,
    COUNT(*) FILTER (WHERE specialty_match = TRUE)                      AS specialty_match_count,
    COUNT(*) FILTER (WHERE ent_score >= 100 AND gpa_year1 < 3.5)       AS fallers,
    COUNT(*) FILTER (WHERE ent_score < 70  AND gpa_year1 >= 3.8)       AS risers,
    COUNT(*) FILTER (WHERE gpa_final < 2.5)                            AS dropouts,
    AVG(avg_salary_tks) FILTER (WHERE gpa_final >= 4.0)                AS avg_sal_good,
    AVG(avg_salary_tks) FILTER (WHERE gpa_final < 3.0)                 AS avg_sal_weak
FROM base
"""

_TABLE_SQL = """
SELECT
    sr.iin,
    sr.ent_score,
    ROUND(AVG(sa.gpa) FILTER (
        WHERE sa.academic_year = sr.enrollment_year
           OR (sr.enrollment_year IS NULL AND sa.semester_number <= 2)
    )::numeric, 1) AS gpa_year1,
    ROUND(AVG(sa.gpa)::numeric, 1)  AS gpa_final,
    COALESCE(se.employment_status, 'unknown') AS employment_status,
    se.specialty_match,
    ROUND(
        (SELECT AVG(ss.salary_amount) / 1000
         FROM student_salary ss
         WHERE ss.iin = sr.iin
           AND ss.period_year = sr.graduation_year + 1)::numeric
    , 0) AS avg_salary_tks
FROM student_registry sr
LEFT JOIN student_academic sa    ON sa.iin = sr.iin
LEFT JOIN student_employment se  ON se.iin = sr.iin
     AND se.period_year = sr.graduation_year + 1
WHERE sr.org_id = CAST(:org_id AS uuid)
  AND sr.graduation_year = :graduation_year
  AND sr.deleted_at IS NULL
GROUP BY sr.iin, sr.ent_score, sr.enrollment_year,
         sr.graduation_year, se.employment_status, se.specialty_match
ORDER BY sr.iin
LIMIT 15
"""

_SCATTER_SQL = """
SELECT
    sr.iin,
    sr.ent_score,
    AVG(sa.gpa) FILTER (
        WHERE sa.academic_year = sr.enrollment_year
           OR (sr.enrollment_year IS NULL AND sa.semester_number <= 2)
    ) AS gpa_year1,
    AVG(sa.gpa) AS gpa_final
FROM student_registry sr
LEFT JOIN student_academic sa ON sa.iin = sr.iin
WHERE sr.org_id = CAST(:org_id AS uuid)
  AND sr.graduation_year = :graduation_year
  AND sr.deleted_at IS NULL
GROUP BY sr.iin, sr.ent_score, sr.enrollment_year
ORDER BY sr.iin
"""


@router.get(
    "/analytics/funnel",
    response_model=TrajectoryFunnelResponse,
    dependencies=[_VIEW_PERM],
    summary="Воронка когорты: поступили → окончили → трудоустроены → по специальности",
)
async def get_funnel(
    org_id:          UUID = Query(...),
    graduation_year: int  = Query(..., ge=2000, le=2035),
    db:              ReadDBSession = None,
    _token=Depends(verify_token),
) -> TrajectoryFunnelResponse:
    result = await db.execute(
        text(_ANALYTICS_SQL),
        {"org_id": str(org_id), "graduation_year": graduation_year},
    )
    row = result.mappings().one()
    total = int(row["total"] or 0)

    def pct(n: int) -> float:
        return round(n / total * 100, 1) if total else 0.0

    graduated = int(row["graduated"] or 0)
    employed  = int(row["employed"] or 0)
    matched   = int(row["specialty_match_count"] or 0)

    funnel = [
        FunnelStep(label="Поступили",           n=total,     pct=100.0,       note="100% когорты"),
        FunnelStep(label="Окончили (GPA ≥ 2.5)", n=graduated, pct=pct(graduated), note=f"Отсев: {total - graduated} чел."),
        FunnelStep(label="Трудоустроены",        n=employed,  pct=pct(employed),  note=f"Безработных: {graduated - employed} чел."),
        FunnelStep(label="По специальности",     n=matched,   pct=pct(matched),   note=f"Не по профилю: {employed - matched} чел."),
    ]
    return TrajectoryFunnelResponse(
        org_id=org_id, graduation_year=graduation_year, total=total, funnel=funnel,
    )


@router.get(
    "/analytics/scatter",
    response_model=TrajectoryScatterResponse,
    dependencies=[_VIEW_PERM],
    summary="Scatter plot: ЕНТ (школа) → GPA 1-го курса",
)
async def get_scatter(
    org_id:          UUID = Query(...),
    graduation_year: int  = Query(..., ge=2000, le=2035),
    db:              ReadDBSession = None,
    _token=Depends(verify_token),
) -> TrajectoryScatterResponse:
    result = await db.execute(
        text(_SCATTER_SQL),
        {"org_id": str(org_id), "graduation_year": graduation_year},
    )
    rows = result.mappings().all()

    points = [
        ScatterPoint(
            iin_masked=_mask_iin(r["iin"]),
            ent_score=r["ent_score"],
            gpa_year1=round(float(r["gpa_year1"]), 2) if r["gpa_year1"] else None,
            gpa_final=round(float(r["gpa_final"]), 2) if r["gpa_final"] else None,
            trajectory=_traj_label(
                r["ent_score"],
                float(r["gpa_year1"]) if r["gpa_year1"] else None,
            ),
        )
        for r in rows
    ]
    return TrajectoryScatterResponse(
        org_id=org_id, graduation_year=graduation_year, points=points,
    )


@router.get(
    "/analytics/patterns",
    response_model=TrajectoryPatternsResponse,
    dependencies=[_VIEW_PERM],
    summary="Паттерн-карточки: падающие отличники, растущие троечники, отсев, зарплатная премия",
)
async def get_patterns(
    org_id:          UUID = Query(...),
    graduation_year: int  = Query(..., ge=2000, le=2035),
    db:              ReadDBSession = None,
    _token=Depends(verify_token),
) -> TrajectoryPatternsResponse:
    result = await db.execute(
        text(_ANALYTICS_SQL),
        {"org_id": str(org_id), "graduation_year": graduation_year},
    )
    row = result.mappings().one()

    total    = int(row["total"] or 0)
    fallers  = int(row["fallers"] or 0)
    risers   = int(row["risers"] or 0)
    dropouts = int(row["dropouts"] or 0)

    good_sal = float(row["avg_sal_good"]) if row["avg_sal_good"] else None
    weak_sal = float(row["avg_sal_weak"]) if row["avg_sal_weak"] else None
    diff_sal = round(good_sal - weak_sal, 1) if good_sal and weak_sal else None

    return TrajectoryPatternsResponse(
        org_id=org_id,
        graduation_year=graduation_year,
        total=total,
        fallers=PatternCard(
            count=fallers,
            label="«Падающие» отличники",
            description="ЕНТ ≥ 100, GPA 1-го курса < 3.5",
        ),
        risers=PatternCard(
            count=risers,
            label="«Растущие» троечники",
            description="ЕНТ < 70, GPA 1-го курса ≥ 3.8",
        ),
        dropouts=PatternCard(
            count=dropouts,
            label="Отсев / академотпуск",
            description="GPA итоговый < 2.5",
        ),
        salary_premium=SalaryPremium(
            good_gpa_avg_tks=round(good_sal, 1) if good_sal else None,
            weak_gpa_avg_tks=round(weak_sal, 1) if weak_sal else None,
            difference_tks=diff_sal,
        ),
    )


@router.get(
    "/analytics/table",
    response_model=TrajectoryTableResponse,
    dependencies=[_VIEW_PERM],
    summary="Таблица студентов когорты (первые 15, с зарплатой и занятостью)",
)
async def get_table(
    org_id:          UUID = Query(...),
    graduation_year: int  = Query(..., ge=2000, le=2035),
    db:              ReadDBSession = None,
    _token=Depends(verify_token),
) -> TrajectoryTableResponse:
    count_res = await db.execute(
        text(
            "SELECT COUNT(*) FROM student_registry "
            "WHERE org_id = CAST(:org_id AS uuid) AND graduation_year = :graduation_year AND deleted_at IS NULL"
        ),
        {"org_id": str(org_id), "graduation_year": graduation_year},
    )
    total = int(count_res.scalar_one() or 0)

    result = await db.execute(
        text(_TABLE_SQL),
        {"org_id": str(org_id), "graduation_year": graduation_year},
    )
    rows_raw = result.mappings().all()

    def _group_label(ent: Optional[int]) -> str:
        if ent is None:       return "—"
        if ent >= 100:        return "Отличник школы"
        if ent >= 70:         return "Хорошист школы"
        return "Троечник школы"

    rows = [
        StudentTableRow(
            iin_masked=_mask_iin(r["iin"]),
            ent_score=r["ent_score"],
            gpa_year1=float(r["gpa_year1"]) if r["gpa_year1"] else None,
            gpa_final=float(r["gpa_final"]) if r["gpa_final"] else None,
            trajectory=_traj_label(
                r["ent_score"],
                float(r["gpa_year1"]) if r["gpa_year1"] else None,
            ),
            group_label=_group_label(r["ent_score"]),
            employed=r["employment_status"] == "employed",
            specialty_match=r["specialty_match"],
            avg_salary_tks=float(r["avg_salary_tks"]) if r["avg_salary_tks"] else None,
        )
        for r in rows_raw
    ]
    return TrajectoryTableResponse(
        org_id=org_id, graduation_year=graduation_year, total=total, rows=rows,
    )
