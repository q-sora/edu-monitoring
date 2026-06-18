"""
tests/conftest.py
─────────────────────────────────────────────────────────────────────────────
Shared pytest fixtures for all test modules.

Strategy:
    • One database session per test, wrapped in a SAVEPOINT that is rolled
      back after the test — the DB is always clean.
    • Token fixtures for each RBAC role so any test can switch context.
    • Factory helpers to seed consistent test data.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4

from app.api.dependencies import TokenPayload, UserRole, verify_token
from app.api.dependencies import get_db_with_rls, get_read_db
from app.core.database import AsyncWriteSession
from app.main import app

# ─── Shared test constants ────────────────────────────────────────────────────

TEST_ORG_A = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
TEST_ORG_B = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
TEST_USER  = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
TEST_ADMIN = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")


def _make_token(
    role: str = UserRole.DATA_ENTRY,
    org_id: str = str(TEST_ORG_A),
    user_id: str = str(TEST_USER),
) -> TokenPayload:
    return TokenPayload(
        sub=user_id,
        role=role,
        org_id=org_id if role == UserRole.DATA_ENTRY else None,
        exp=9_999_999_999,
        jti=f"test-jti-{role}",
        email=f"{role}@test.kz",
    )


# ─── Session fixture ──────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Yield a session whose transaction is rolled back after the test."""
    async with AsyncWriteSession() as session:
        async with session.begin():
            yield session
            await session.rollback()


# ─── Token fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def token_data_entry() -> TokenPayload:
    return _make_token(UserRole.DATA_ENTRY)


@pytest.fixture
def token_admin() -> TokenPayload:
    return _make_token(UserRole.ADMIN, org_id=None, user_id=str(TEST_ADMIN))


@pytest.fixture
def token_superadmin() -> TokenPayload:
    return _make_token(UserRole.SUPERADMIN, org_id=None)


@pytest.fixture
def token_management() -> TokenPayload:
    return _make_token(UserRole.MANAGEMENT, org_id=None)


# ─── Client factory ───────────────────────────────────────────────────────────

def _make_client(db_session: AsyncSession, token: TokenPayload) -> AsyncClient:
    """Returns an httpx AsyncClient with the given DB session and token."""

    async def fake_verify_token() -> TokenPayload:
        return token

    async def fake_db() -> AsyncSession:
        yield db_session

    app.dependency_overrides[verify_token]   = fake_verify_token
    app.dependency_overrides[get_db_with_rls] = fake_db
    app.dependency_overrides[get_read_db] = fake_db

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest_asyncio.fixture
async def client_data_entry(db_session, token_data_entry):
    async with _make_client(db_session, token_data_entry) as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_admin(db_session, token_admin):
    async with _make_client(db_session, token_admin) as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_superadmin(db_session, token_superadmin):
    async with _make_client(db_session, token_superadmin) as c:
        yield c
    app.dependency_overrides.clear()


# ─── Data factories ───────────────────────────────────────────────────────────

class ScienceFactory:
    BASE = f"/api/v1/organisations/{TEST_ORG_A}/science-activity"

    @staticmethod
    def payload(year: int = 2024, status: str = "draft") -> dict:
        return {
            "period_year":       year,
            "publications_scopus": 40,
            "publications_wos":   15,
            "hirsch_index_avg":  "3.50",
            "grants_json": [{"title": f"Grant {year}", "amount": "10000000"}],
            "submission_status": status,
        }


class ContingentFactory:
    BASE = f"/api/v1/organisations/{TEST_ORG_A}/contingent"

    @staticmethod
    def payload(snapshot_date: str = "2026-04-01", status: str = "draft") -> dict:
        return {
            "snapshot_date":  snapshot_date,
            "total_count":    5000,
            "budget_count":   3000,
            "paid_count":     2000,
            "kz_lang_count":  4000,
            "ru_lang_count":  1000,
            "submission_status": status,
        }
