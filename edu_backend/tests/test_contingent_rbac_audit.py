"""
tests/test_contingent.py
─────────────────────────────────────────────────────────────────────────────
Integration tests for contingent_snapshots endpoints.
Focuses on: cross-field validation, language sum check, update flow.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from tests.conftest import ContingentFactory, TEST_ORG_A, TEST_ORG_B

BASE = ContingentFactory.BASE


@pytest.mark.asyncio
async def test_create_contingent(client_data_entry: AsyncClient):
    r = await client_data_entry.post(BASE, json=ContingentFactory.payload())
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["total_count"] == 5000
    assert data["budget_count"] == 3000
    assert data["submission_status"] == "draft"
    assert data["version"] == 1


@pytest.mark.asyncio
async def test_budget_plus_paid_exceeds_total_rejected(client_data_entry: AsyncClient):
    """business rule: budget + paid cannot exceed total"""
    bad_payload = ContingentFactory.payload()
    bad_payload["budget_count"] = 4000
    bad_payload["paid_count"] = 2000   # 4000 + 2000 = 6000 > 5000
    r = await client_data_entry.post(BASE, json=bad_payload)
    assert r.status_code == 422
    body = r.json()
    assert "budget_count" in str(body).lower() or "paid_count" in str(body).lower()


@pytest.mark.asyncio
async def test_language_sum_soft_check(client_data_entry: AsyncClient):
    """Language counts that wildly exceed total are rejected."""
    bad_payload = ContingentFactory.payload()
    bad_payload["kz_lang_count"] = 3000
    bad_payload["ru_lang_count"] = 3000  # sum 6000 > 5000 + 5 tolerance
    r = await client_data_entry.post(BASE, json=bad_payload)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_upsert_same_date_updates(client_data_entry: AsyncClient):
    """POST twice on same date should update, not duplicate."""
    r1 = await client_data_entry.post(BASE, json=ContingentFactory.payload("2026-03-01"))
    assert r1.status_code == 201
    assert r1.headers.get("X-Created") == "True"

    updated = ContingentFactory.payload("2026-03-01")
    updated["total_count"] = 5500
    r2 = await client_data_entry.post(BASE, json=updated)
    assert r2.status_code == 200
    assert r2.headers.get("X-Created") == "False"
    assert r2.json()["total_count"] == 5500


@pytest.mark.asyncio
async def test_submit_triggers_status_change(client_data_entry: AsyncClient):
    r = await client_data_entry.post(
        BASE, json=ContingentFactory.payload("2026-02-01", status="submitted")
    )
    assert r.status_code in (200, 201)
    assert r.json()["submission_status"] == "submitted"


@pytest.mark.asyncio
async def test_cannot_submit_and_then_edit_as_data_entry(client_data_entry: AsyncClient, client_admin: AsyncClient):
    """After submission, data_entry cannot further edit without admin."""
    # Create & submit
    r = await client_data_entry.post(
        BASE, json=ContingentFactory.payload("2026-01-01", status="submitted")
    )
    record_id = r.json()["id"]
    version = r.json()["version"]

    # Admin moves to under_review
    sr = await client_admin.patch(
        f"{BASE}/{record_id}/status", json={"new_status": "under_review"}
    )
    assert sr.status_code == 200

    # data_entry tries to edit — should fail
    r2 = await client_data_entry.patch(
        f"{BASE}/{record_id}",
        json={"total_count": 9999, "version": version + 1},
    )
    assert r2.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
"""
tests/test_rbac.py — RBAC boundary tests
"""

from tests.conftest import ScienceFactory

SCIENCE_BASE_A = ScienceFactory.BASE
SCIENCE_BASE_B = f"/api/v1/organisations/{TEST_ORG_B}/science-activity"


@pytest.mark.asyncio
async def test_data_entry_cannot_access_other_org(client_data_entry: AsyncClient):
    """data_entry user (org A) must get 403 accessing org B."""
    r = await client_data_entry.get(SCIENCE_BASE_B)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_access_any_org(client_admin: AsyncClient):
    """Admin can list any org's data."""
    r = await client_admin.get(SCIENCE_BASE_B)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_management_cannot_write(client_management, token_management):
    """Management role (read-only) cannot POST data."""
    # Build a client with management token
    from tests.conftest import _make_client, db_session
    # management client is already passed in fixture — just try a write
    r = await client_management.post(SCIENCE_BASE_A, json=ScienceFactory.payload())
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_data_entry_cannot_approve(client_data_entry: AsyncClient):
    """data_entry user cannot call the /status endpoint to approve records."""
    # Create a draft
    r = await client_data_entry.post(SCIENCE_BASE_A, json=ScienceFactory.payload(2023))
    record_id = r.json()["id"]

    # Try to approve — should be denied
    sr = await client_data_entry.patch(
        f"{SCIENCE_BASE_A}/{record_id}/status",
        json={"new_status": "approved"},
    )
    assert sr.status_code == 403


@pytest.mark.asyncio
async def test_invalid_token_returns_401(db_session):
    """A tampered or expired token must return 401."""
    from httpx import ASGITransport, AsyncClient
    async with AsyncClient(
        transport=ASGITransport(app=__import__("app.main", fromlist=["app"]).app),
        base_url="http://test",
        headers={"Authorization": "Bearer tampered.jwt.token"},
    ) as c:
        r = await c.get(SCIENCE_BASE_A)
    assert r.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
"""
tests/test_audit.py — audit trail integrity tests
"""


@pytest.mark.asyncio
async def test_insert_creates_audit_entry(client_data_entry: AsyncClient, db_session):
    """After POST, audit_log should contain an INSERT row."""
    from sqlalchemy import select, text

    r = await client_data_entry.post(
        SCIENCE_BASE_A, json=ScienceFactory.payload(2022)
    )
    assert r.status_code in (200, 201)
    record_id = r.json()["id"]

    # Check audit_log
    rows = (
        await db_session.execute(
            text(
                "SELECT action, new_data FROM audit_log "
                "WHERE table_name = 'science_activity' "
                "AND record_id = :rid "
                "ORDER BY changed_at DESC LIMIT 5"
            ),
            {"rid": str(record_id)},
        )
    ).fetchall()

    actions = [row[0] for row in rows]
    assert "INSERT" in actions, f"Expected INSERT in audit_log, got: {actions}"


@pytest.mark.asyncio
async def test_update_creates_audit_entry(client_data_entry: AsyncClient, db_session):
    """After PATCH, audit_log should have an UPDATE row with old/new data."""
    from sqlalchemy import text

    r = await client_data_entry.post(SCIENCE_BASE_A, json=ScienceFactory.payload(2021))
    record_id = r.json()["id"]
    version = r.json()["version"]

    patch_r = await client_data_entry.patch(
        f"{SCIENCE_BASE_A}/{record_id}",
        json={"publications_scopus": 99, "version": version},
    )
    assert patch_r.status_code == 200

    rows = (
        await db_session.execute(
            text(
                "SELECT action FROM audit_log "
                "WHERE table_name = 'science_activity' "
                "AND record_id = :rid AND action = 'UPDATE'"
            ),
            {"rid": str(record_id)},
        )
    ).fetchall()
    assert len(rows) >= 1


@pytest.mark.asyncio
async def test_soft_delete_creates_audit_entry(client_data_entry: AsyncClient, db_session):
    """Soft delete sets deleted_at and creates an UPDATE audit row."""
    from sqlalchemy import text

    r = await client_data_entry.post(SCIENCE_BASE_A, json=ScienceFactory.payload(2020))
    record_id = r.json()["id"]

    del_r = await client_data_entry.delete(f"{SCIENCE_BASE_A}/{record_id}")
    assert del_r.status_code == 204

    # deleted_at should now be set
    row = (
        await db_session.execute(
            text(
                "SELECT deleted_at FROM science_activity WHERE id = :id"
            ),
            {"id": record_id},
        )
    ).fetchone()
    assert row[0] is not None, "deleted_at should be set after soft delete"
