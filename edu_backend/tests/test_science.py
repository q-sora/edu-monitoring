"""
tests/test_science.py
─────────────────────────────────────────────────────────────────────────────
Integration tests for the science activity endpoints.

Pattern used:
  • pytest-asyncio with `asyncio_mode = "auto"` (configured in pyproject.toml)
  • httpx.AsyncClient with ASGITransport for in-process requests (no network)
  • Override FastAPI dependencies to inject a test database session and a
    fake authenticated user — no JWT signing required in tests.
  • Each test runs inside a transaction that is rolled back after the test,
    so the DB is always clean (no teardown needed).
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import verify_token
from app.core.database import AsyncWriteSession
from app.main import app
from app.schemas.science import TokenPayload


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

TEST_ORG_ID = "00000000-0000-0000-0000-000000000001"
TEST_USER_ID = "00000000-0000-0000-0000-000000000099"


def make_token(role: str = "data_entry", org_id: str = TEST_ORG_ID) -> TokenPayload:
    return TokenPayload(
        sub=TEST_USER_ID,
        role=role,
        org_id=org_id,
        exp=9999999999,   # far future
        jti="test-jti",
    )


@pytest.fixture
async def db_session():
    """
    Yields a session that wraps every test in a SAVEPOINT.
    The outer transaction is never committed — the DB is clean after each test.
    """
    async with AsyncWriteSession() as session:
        async with session.begin():
            yield session
            await session.rollback()


@pytest.fixture
def data_entry_token():
    return make_token(role="data_entry")


@pytest.fixture
def admin_token():
    return make_token(role="admin", org_id=None)


@pytest.fixture
async def client(db_session: AsyncSession, data_entry_token: TokenPayload):
    """
    AsyncClient with dependency overrides:
      - verify_token → returns fake token (no JWT validation)
      - get_db       → reuses the test session (so writes see each other)
    """

    async def fake_verify_token():
        return data_entry_token

    async def fake_get_db():
        yield db_session

    app.dependency_overrides[verify_token] = fake_verify_token
    # Override all DB deps
    from app.api.dependencies import get_db_with_rls, get_read_db_dep
    app.dependency_overrides[get_db_with_rls] = fake_get_db
    app.dependency_overrides[get_read_db_dep] = fake_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

BASE = f"/api/v1/organisations/{TEST_ORG_ID}/science-activity"


@pytest.mark.asyncio
async def test_create_science_activity(client: AsyncClient):
    """POST creates a new record and returns 201."""
    payload = {
        "period_year": 2024,
        "publications_scopus": 42,
        "publications_wos": 18,
        "hirsch_index_avg": "3.5",
        "grants_json": [
            {"title": "ИРН AP13169500 — ML systems", "amount": "50000000", "direction": "IT"},
        ],
        "student_projects_json": [
            {"title": "EduBot AI", "stage": "MVP"},
        ],
        "submission_status": "draft",
    }

    resp = await client.post(BASE, json=payload)
    assert resp.status_code == 201, resp.text

    data = resp.json()
    assert data["period_year"] == 2024
    assert data["publications_scopus"] == 42
    assert len(data["grants_json"]) == 1
    assert data["grants_json"][0]["title"] == "ИРН AP13169500 — ML systems"
    assert data["submission_status"] == "draft"
    assert data["version"] == 1


@pytest.mark.asyncio
async def test_upsert_same_year_updates_record(client: AsyncClient):
    """POST for the same (org_id, year) should update the existing record."""
    payload = {"period_year": 2023, "publications_scopus": 10, "submission_status": "draft"}
    r1 = await client.post(BASE, json=payload)
    assert r1.status_code == 201

    # Same year, different value
    payload["publications_scopus"] = 25
    r2 = await client.post(BASE, json=payload)
    assert r2.status_code == 200              # Updated, not created
    assert r2.headers["X-Created"] == "False"
    assert r2.json()["publications_scopus"] == 25


@pytest.mark.asyncio
async def test_optimistic_lock_conflict(client: AsyncClient):
    """PATCH with stale version returns 409."""
    create_payload = {"period_year": 2022, "publications_scopus": 5, "submission_status": "draft"}
    r = await client.post(BASE, json=create_payload)
    record_id = r.json()["id"]
    current_version = r.json()["version"]

    # First PATCH succeeds
    patch1 = {"publications_scopus": 10, "version": current_version}
    r1 = await client.patch(f"{BASE}/{record_id}", json=patch1)
    assert r1.status_code == 200

    # Second PATCH with old version should fail
    patch2 = {"publications_scopus": 99, "version": current_version}   # stale version
    r2 = await client.patch(f"{BASE}/{record_id}", json=patch2)
    assert r2.status_code == 409
    assert "Concurrent modification" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_cannot_edit_approved_record(client: AsyncClient, admin_token):
    """PATCH on an approved record returns 403."""
    # Create
    r = await client.post(BASE, json={"period_year": 2021, "submission_status": "draft"})
    record_id = r.json()["id"]
    v = r.json()["version"]

    # Submit
    await client.patch(f"{BASE}/{record_id}", json={"submission_status": "submitted", "version": v})

    # Admin approves — switch to admin token
    from app.api.dependencies import verify_token as vt
    app.dependency_overrides[vt] = lambda: admin_token
    await client.patch(f"{BASE}/{record_id}/status", json={"new_status": "under_review"})
    await client.patch(f"{BASE}/{record_id}/status", json={"new_status": "approved"})
    app.dependency_overrides[vt] = lambda: admin_token   # restore

    # Try to edit as data_entry
    r_edit = await client.patch(
        f"{BASE}/{record_id}", json={"publications_scopus": 99, "version": 3}
    )
    assert r_edit.status_code == 403


@pytest.mark.asyncio
async def test_org_isolation(client: AsyncClient):
    """data_entry user cannot access another org's data."""
    other_org = "ffffffff-ffff-ffff-ffff-ffffffffffff"
    r = await client.get(f"/api/v1/organisations/{other_org}/science-activity")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_soft_delete(client: AsyncClient):
    """DELETE soft-deletes; subsequent GET returns 404."""
    r = await client.post(BASE, json={"period_year": 2020, "submission_status": "draft"})
    record_id = r.json()["id"]

    del_r = await client.delete(f"{BASE}/{record_id}")
    assert del_r.status_code == 204

    get_r = await client.get(f"{BASE}/{record_id}")
    assert get_r.status_code == 404


@pytest.mark.asyncio
async def test_jsonb_empty_titles_are_filtered(client: AsyncClient):
    """Grants with blank titles should be dropped before saving."""
    payload = {
        "period_year": 2019,
        "submission_status": "draft",
        "grants_json": [
            {"title": "Real Grant", "amount": "1000000"},
            {"title": "  ", "amount": "0"},    # blank — should be filtered
            {"title": "", "direction": "IT"},   # blank — should be filtered
        ],
    }
    r = await client.post(BASE, json=payload)
    assert r.status_code == 201
    assert len(r.json()["grants_json"]) == 1
    assert r.json()["grants_json"][0]["title"] == "Real Grant"
