# edu_backend/tests/test_edu_level.py
from __future__ import annotations

import json
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
async def seed_edu_level_data(db_session: AsyncSession):
    # Clear tables to ensure clean state
    await db_session.execute(text("DELETE FROM org_indicator_assessments"))
    await db_session.execute(text("DELETE FROM edu_level_sector_stats"))

    # Ensure organizations exist
    await db_session.execute(
        text(
            "INSERT INTO organizations (id, name_ru, status) "
            "VALUES (:org_id, 'Школа №1', 'active') "
            "ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru"
        ),
        {"org_id": TEST_ORG_A},
    )
    await db_session.execute(
        text(
            "INSERT INTO organizations (id, name_ru, status) "
            "VALUES (:org_id, 'Школа №2', 'active') "
            "ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru"
        ),
        {"org_id": TEST_ORG_B},
    )

    # Seed edu_level_sector_stats
    await db_session.execute(
        text("""
            INSERT INTO edu_level_sector_stats (edu_level, period_year, total_orgs_rk, goz_billion_kzt)
            VALUES ('so', 2026, 9193, 3600.0)
        """)
    )

    # Seed org_indicator_assessments
    # scores_json for organization A
    scores_a = {
        "block_1": {"score": 18.2, "title": "Инфраструктура и безопасность", "weight": 22, "max_score": 22},
        "block_2": {"score": 60.0, "title": "Качество обучения", "weight": 78, "max_score": 78}
    }
    # scores_json for organization B
    scores_b = {
        "block_1": {"score": 10.0, "title": "Инфраструктура и безопасность", "weight": 22, "max_score": 22},
        "block_2": {"score": 40.0, "title": "Качество обучения", "weight": 78, "max_score": 78}
    }

    await db_session.execute(
        text("""
            INSERT INTO org_indicator_assessments (id, org_id, edu_level, period_year, total_score, scores_json)
            VALUES 
                ('00000000-0000-0000-0000-000000000001', :org_a, 'so', 2026, 78.2, CAST(:scores_a AS jsonb)),
                ('00000000-0000-0000-0000-000000000002', :org_b, 'so', 2026, 50.0, CAST(:scores_b AS jsonb))
        """),
        {
            "org_a": TEST_ORG_A,
            "org_b": TEST_ORG_B,
            "scores_a": json.dumps(scores_a),
            "scores_b": json.dumps(scores_b),
        }
    )


@pytest.mark.asyncio
async def test_get_edu_level_stats_success(client_admin: AsyncClient):
    """GET /edu-level/so/stats returns calculated block metrics and org list."""
    resp = await client_admin.get("/api/v1/edu-level/so/stats?period_year=2026")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["period_year"] == 2026
    assert data["edu_level"] == "so"

    # Verify summary
    summary = data["summary"]
    assert summary["org_count"] == 2
    assert summary["avg_score"] == 64.1  # (78.2 + 50.0) / 2 = 64.1
    assert summary["zones"] == {"green": 1, "yellow": 1, "red": 0}

    # Verify blocks aggregate
    blocks = data["blocks"]
    assert len(blocks) == 2
    # Sorted by block key (block_1, block_2)
    assert blocks[0]["id"] == "block_1"
    assert blocks[0]["title"] == "Инфраструктура и безопасность"
    assert blocks[0]["weight"] == 22
    assert blocks[0]["avg_score"] == 14.1  # (18.2 + 10.0) / 2 = 14.1
    assert blocks[0]["avg_pct"] == 64.1  # round((14.1 / 22) * 100, 1) = 64.1

    assert blocks[1]["id"] == "block_2"
    assert blocks[1]["title"] == "Качество обучения"
    assert blocks[1]["weight"] == 78
    assert blocks[1]["avg_score"] == 50.0  # (60.0 + 40.0) / 2 = 50.0
    assert blocks[1]["avg_pct"] == 64.1  # round((50.0 / 78) * 100, 1) = 64.1

    # Verify orgs list
    orgs = data["orgs"]
    assert len(orgs) == 2
    # Sorted by total_score desc
    assert orgs[0]["id"] == str(TEST_ORG_A)
    assert orgs[0]["name"] == "Школа №1"
    assert orgs[0]["total_score"] == 78.2
    assert orgs[0]["zone"] == "green"
    assert orgs[0]["block_scores"] == {"block_1": 18.2, "block_2": 60.0}

    assert orgs[1]["id"] == str(TEST_ORG_B)
    assert orgs[1]["name"] == "Школа №2"
    assert orgs[1]["total_score"] == 50.0
    assert orgs[1]["zone"] == "yellow"
    assert orgs[1]["block_scores"] == {"block_1": 10.0, "block_2": 40.0}


@pytest.mark.asyncio
async def test_get_edu_level_stats_default_year(client_admin: AsyncClient):
    """GET /edu-level/so/stats automatically defaults to max year if period_year is omitted."""
    resp = await client_admin.get("/api/v1/edu-level/so/stats")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["period_year"] == 2026


@pytest.mark.asyncio
async def test_get_edu_level_stats_invalid_level(client_admin: AsyncClient):
    """GET /edu-level/invalid/stats returns 422 validation error."""
    resp = await client_admin.get("/api/v1/edu-level/invalid/stats")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_edu_level_sector_stats_success(client_admin: AsyncClient):
    """GET /edu-level/so/sector-stats returns sector statistics."""
    resp = await client_admin.get("/api/v1/edu-level/so/sector-stats?period_year=2026")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["edu_level"] == "so"
    assert data["period_year"] == 2026
    assert data["total_orgs_rk"] == 9193
    assert data["goz_billion_kzt"] == 3600.0


@pytest.mark.asyncio
async def test_get_edu_level_sector_stats_default_year(client_admin: AsyncClient):
    """GET /edu-level/so/sector-stats automatically defaults to max year if omitted."""
    resp = await client_admin.get("/api/v1/edu-level/so/sector-stats")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["period_year"] == 2026


@pytest.mark.asyncio
async def test_get_edu_level_sector_stats_invalid_level(client_admin: AsyncClient):
    """GET /edu-level/invalid/sector-stats returns 422 validation error."""
    resp = await client_admin.get("/api/v1/invalid/sector-stats")
    assert resp.status_code == 404  # Wait, wait, actually let's use the router prefix, which is /edu-level/invalid/sector-stats. Let's make sure it is correct.
    # Wait, /api/v1/edu-level/invalid/sector-stats: 
    # level = "invalid" -> get_edu_level_sector_stats checks: if level not in ("do", "so", "dopo", "tippo", "vipo"): raise HTTPException(422)
    # So it should be 422.
    resp2 = await client_admin.get("/api/v1/edu-level/invalid/sector-stats")
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_get_edu_level_sector_stats_not_found(client_admin: AsyncClient):
    """GET /edu-level/so/sector-stats for year without data returns 404."""
    resp = await client_admin.get("/api/v1/edu-level/so/sector-stats?period_year=2030")
    assert resp.status_code == 404
