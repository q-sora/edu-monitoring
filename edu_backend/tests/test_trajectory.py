"""
tests/test_trajectory.py
─────────────────────────────────────────────────────────────────────────────
Integration tests for student trajectory analytics endpoints.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from tests.conftest import TEST_ORG_A, TEST_ORG_B


@pytest.fixture(autouse=True)
async def cleanup_db_connections():
    yield
    from app.core.database import engine_write, engine_read
    await engine_write.dispose()
    await engine_read.dispose()



@pytest.fixture(autouse=True)
async def seed_trajectory_data(db_session: AsyncSession):
    """Seed test data for organization and student trajectories."""
    # Clear tables to ensure clean state
    await db_session.execute(text("DELETE FROM student_salary"))
    await db_session.execute(text("DELETE FROM student_employment"))
    await db_session.execute(text("DELETE FROM student_academic"))
    await db_session.execute(text("DELETE FROM student_registry"))

    # Ensure organization A exists
    await db_session.execute(
        text(
            "INSERT INTO organizations (id, name_ru, status) "
            "VALUES (:org_id, 'Test Org A', 'active') "
            "ON CONFLICT (id) DO NOTHING"
        ),
        {"org_id": TEST_ORG_A},
    )
    # Ensure organization B exists (for isolation check if needed)
    await db_session.execute(
        text(
            "INSERT INTO organizations (id, name_ru, status) "
            "VALUES (:org_id, 'Test Org B', 'active') "
            "ON CONFLICT (id) DO NOTHING"
        ),
        {"org_id": TEST_ORG_B},
    )

    # 1. Seed Student Registry (NCT base data)
    # Student 1: Weak, Faller, Dropout, low salary
    await db_session.execute(
        text(
            "INSERT INTO student_registry "
            "(iin, org_id, education_level, graduation_year, enrollment_year, ent_score, is_grant, version) "
            "VALUES ('111111111111', :org_id, 'bachelor', 2026, 2022, 110, true, 1)"
        ),
        {"org_id": TEST_ORG_A},
    )
    # Student 2: Rising, Employed, specialty match
    await db_session.execute(
        text(
            "INSERT INTO student_registry "
            "(iin, org_id, education_level, graduation_year, enrollment_year, ent_score, is_grant, version) "
            "VALUES ('222222222222', :org_id, 'bachelor', 2026, 2022, 65, true, 1)"
        ),
        {"org_id": TEST_ORG_A},
    )
    # Student 3: Stable, Employed, no specialty match
    await db_session.execute(
        text(
            "INSERT INTO student_registry "
            "(iin, org_id, education_level, graduation_year, enrollment_year, ent_score, is_grant, version) "
            "VALUES ('333333333333', :org_id, 'bachelor', 2026, 2022, 85, true, 1)"
        ),
        {"org_id": TEST_ORG_A},
    )
    # Student 4: High GPA, Employed, specialty match, high salary
    await db_session.execute(
        text(
            "INSERT INTO student_registry "
            "(iin, org_id, education_level, graduation_year, enrollment_year, ent_score, is_grant, version) "
            "VALUES ('444444444444', :org_id, 'bachelor', 2026, 2022, 120, true, 1)"
        ),
        {"org_id": TEST_ORG_A},
    )

    # 2. Seed Student Academics (GPA per semester)
    # Student 1: Faller & Dropout (GPA < 2.5 final, GPA first course < 3.5)
    await db_session.execute(
        text(
            "INSERT INTO student_academic (iin, academic_year, semester_number, gpa, credits_earned) "
            "VALUES ('111111111111', 2022, 1, 2.4, 30), "
            "       ('111111111111', 2022, 2, 2.4, 30), "
            "       ('111111111111', 2025, 7, 2.4, 30)"
        )
    )
    # Student 2: Riser (ENT < 70, first course GPA >= 3.8)
    await db_session.execute(
        text(
            "INSERT INTO student_academic (iin, academic_year, semester_number, gpa, credits_earned) "
            "VALUES ('222222222222', 2022, 1, 3.8, 30), "
            "       ('222222222222', 2022, 2, 3.9, 30)"
        )
    )
    # Student 3: Stable (ENT 85, GPA ~3.5)
    await db_session.execute(
        text(
            "INSERT INTO student_academic (iin, academic_year, semester_number, gpa, credits_earned) "
            "VALUES ('333333333333', 2022, 1, 3.5, 30), "
            "       ('333333333333', 2022, 2, 3.5, 30)"
        )
    )
    # Student 4: Strong (GPA final >= 4.0)
    await db_session.execute(
        text(
            "INSERT INTO student_academic (iin, academic_year, semester_number, gpa, credits_earned) "
            "VALUES ('444444444444', 2022, 1, 4.0, 30), "
            "       ('444444444444', 2022, 2, 4.0, 30)"
        )
    )

    # 3. Seed Student Employment (graduation_year + 1 = 2027)
    # Student 1: employed, low salary
    await db_session.execute(
        text(
            "INSERT INTO student_employment (iin, period_year, employment_status, specialty_match) "
            "VALUES ('111111111111', 2027, 'employed', false)"
        )
    )
    # Student 2: employed, matching specialty
    await db_session.execute(
        text(
            "INSERT INTO student_employment (iin, period_year, employment_status, specialty_match) "
            "VALUES ('222222222222', 2027, 'employed', true)"
        )
    )
    # Student 3: employed, no specialty match
    await db_session.execute(
        text(
            "INSERT INTO student_employment (iin, period_year, employment_status, specialty_match) "
            "VALUES ('333333333333', 2027, 'employed', false)"
        )
    )
    # Student 4: employed, matching specialty
    await db_session.execute(
        text(
            "INSERT INTO student_employment (iin, period_year, employment_status, specialty_match) "
            "VALUES ('444444444444', 2027, 'employed', true)"
        )
    )

    # 4. Seed Student Salary (graduation_year + 1 = 2027)
    # Student 1: weak salary
    await db_session.execute(
        text(
            "INSERT INTO student_salary (iin, period_year, period_quarter, salary_amount, source_type) "
            "VALUES ('111111111111', 2027, 1, 150000.00, 'kgd'), "
            "       ('111111111111', 2027, 2, 150000.00, 'kgd')"
        )
    )
    # Student 4: strong salary
    await db_session.execute(
        text(
            "INSERT INTO student_salary (iin, period_year, period_quarter, salary_amount, source_type) "
            "VALUES ('444444444444', 2027, 1, 550000.00, 'kgd'), "
            "       ('444444444444', 2027, 2, 550000.00, 'kgd')"
        )
    )

    # No commit here — conftest db_session transaction handles rollbacks


@pytest.mark.asyncio
async def test_get_funnel(client_admin: AsyncClient):
    """GET /trajectory/analytics/funnel returns correct cohort funnel calculation."""
    resp = await client_admin.get(
        f"/api/v1/trajectory/analytics/funnel?org_id={TEST_ORG_A}&graduation_year=2026"
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 4
    funnel = data["funnel"]
    assert len(funnel) == 4
    
    # Steps checking:
    # 1. Поступили (total)
    assert funnel[0]["label"] == "Поступили"
    assert funnel[0]["n"] == 4
    assert funnel[0]["pct"] == 100.0

    # 2. Окончили (GPA >= 2.5) -> Student 2 (3.85), Student 3 (3.5), Student 4 (4.0). Student 1 is 2.4 < 2.5.
    # So 3 students.
    assert funnel[1]["label"] == "Окончили (GPA ≥ 2.5)"
    assert funnel[1]["n"] == 3
    assert funnel[1]["pct"] == 75.0

    # 3. Трудоустроены -> all 4 are employed.
    assert funnel[2]["label"] == "Трудоустроены"
    assert funnel[2]["n"] == 4
    assert funnel[2]["pct"] == 100.0

    # 4. По специальности -> Student 2 & Student 4 have specialty_match = True.
    assert funnel[3]["label"] == "По специальности"
    assert funnel[3]["n"] == 2
    assert funnel[3]["pct"] == 50.0


@pytest.mark.asyncio
async def test_get_scatter(client_admin: AsyncClient):
    """GET /trajectory/analytics/scatter returns student points with masked IINs."""
    resp = await client_admin.get(
        f"/api/v1/trajectory/analytics/scatter?org_id={TEST_ORG_A}&graduation_year=2026"
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    points = data["points"]
    assert len(points) == 4

    # Verify masked IINs
    for p in points:
        assert p["iin_masked"].startswith("****")
        assert len(p["iin_masked"]) == 12

    # Check classifications
    # Student 1: ent_score = 110, gpa_year1 = 3.0 -> faller (ENT >= 100, GPA 1st course < 3.5)
    fallers = [p for p in points if p["trajectory"] == "faller"]
    assert len(fallers) == 1

    # Student 2: ent_score = 65, gpa_year1 = 3.85 -> riser (ENT < 70, GPA 1st course >= 3.8)
    risers = [p for p in points if p["trajectory"] == "riser"]
    assert len(risers) == 1


@pytest.mark.asyncio
async def test_get_patterns(client_admin: AsyncClient):
    """GET /trajectory/analytics/patterns returns count of fallers, risers, dropouts and salary premium."""
    resp = await client_admin.get(
        f"/api/v1/trajectory/analytics/patterns?org_id={TEST_ORG_A}&graduation_year=2026"
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 4
    assert data["fallers"]["count"] == 1
    assert data["risers"]["count"] == 1
    assert data["dropouts"]["count"] == 1

    # Salary Premium
    premium = data["salary_premium"]
    assert premium["good_gpa_avg_tks"] == 550000.0
    assert premium["weak_gpa_avg_tks"] == 150000.0
    assert premium["difference_tks"] == 400000.0


@pytest.mark.asyncio
async def test_get_table(client_admin: AsyncClient):
    """GET /trajectory/analytics/table returns list of masked rows."""
    resp = await client_admin.get(
        f"/api/v1/trajectory/analytics/table?org_id={TEST_ORG_A}&graduation_year=2026"
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 4
    rows = data["rows"]
    assert len(rows) == 4
    
    # Check fields
    r1 = rows[0]
    assert "iin_masked" in r1
    assert "ent_score" in r1
    assert "gpa_final" in r1
    assert "group_label" in r1
    assert "employed" in r1


@pytest.mark.asyncio
async def test_rbac_view_permission(client_data_entry: AsyncClient):
    """data_entry user does not have data.view_all permission and is blocked with 403."""
    resp = await client_data_entry.get(
        f"/api/v1/trajectory/analytics/funnel?org_id={TEST_ORG_A}&graduation_year=2026"
    )
    assert resp.status_code == 403
