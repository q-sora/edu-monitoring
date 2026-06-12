"""
core/database.py
─────────────────────────────────────────────────────────────────────────────
Async SQLAlchemy 2.0 engine wired to asyncpg with production-grade pool
settings for high-concurrency government reporting traffic.

Pool sizing rationale
─────────────────────
  pool_size   = CPU_COUNT × 2
  max_overflow = pool_size
  pool_timeout = 10s         (fail fast under load → 503, not indefinite wait)
  pool_recycle = 1800s       (recycle before managed PgBouncer idle close)
  pool_pre_ping = True       (validate stale connections)

IMPORTANT production notes
──────────────────────────
  1. `SET LOCAL` ONLY works inside an active transaction.  We do NOT call it
     from get_db() anymore (there's no open transaction yet when the session
     is yielded — SQLAlchemy starts one lazily on first execute).  Setting
     the RLS context is done via dependencies.get_db_with_rls() at the
     dependency layer, where we explicitly begin a transaction first.

  2. Pool-level connection hook: app.* GUC variables that must exist BEFORE
     any query are set via `ALTER DATABASE SET` at deployment time OR via
     the pg_catalog.set_config() call inside the `connect` event.  They are
     connection-global and cheap.

  3. `echo=False` in production — echo=True creates one log line per query,
     which is fine for debugging but floods logs under concurrent load.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Engine factory
# ─────────────────────────────────────────────────────────────────────────────

def _make_engine(dsn: str, *, pool_size: int, max_overflow: int, echo: bool) -> AsyncEngine:
    """
    Centralised engine factory so PRIMARY and REPLICA share identical tuning.
    """
    return create_async_engine(
        dsn,
        # ── Pool settings (high-load tuning) ───────────────────────────────
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=1800,
        pool_pre_ping=True,
        # ── asyncpg driver options ─────────────────────────────────────────
        connect_args={
            "server_settings": {
                "jit": "off",
                "application_name": "edu_monitoring_api",
            },
            "command_timeout": 60,
            "statement_cache_size": 100,
        },
        # ── Misc ──────────────────────────────────────────────────────────
        echo=echo,
        echo_pool=False,
        future=True,
        execution_options={
            "isolation_level": "READ COMMITTED",
        },
    )


# PRIMARY — handles all INSERT / UPDATE / DELETE
engine_write: AsyncEngine = _make_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    echo=settings.DEBUG,
)

# READ REPLICA — handles all SELECT / analytics queries
engine_read: AsyncEngine = _make_engine(
    settings.DATABASE_REPLICA_URL or settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    echo=False,
)


# ─────────────────────────────────────────────────────────────────────────────
# Session factories
# ─────────────────────────────────────────────────────────────────────────────

AsyncWriteSession: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine_write,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

AsyncReadSession: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine_read,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ─────────────────────────────────────────────────────────────────────────────
# Declarative base
# ─────────────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    """
    All ORM models inherit from this.
    SQLAlchemy 2.0 style: uses Python type annotations for columns.
    """
    pass


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI dependency injectors
# ─────────────────────────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yields a write-capable session.
    Callers own commit/rollback.  We do NOT start a transaction here.

    Note: We do NOT run `SET LOCAL app.org_id` here — that only works inside
    an already-open transaction and would raise/silently fail otherwise.
    RLS session variables are set by dependencies.get_db_with_rls() which
    has access to the JWT token.
    """
    session = AsyncWriteSession()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yields a read-only session routed to the replica engine.
    Use for all GET / analytics endpoints.
    """
    session = AsyncReadSession()
    try:
        yield session
    finally:
        await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Context-manager version for Celery workers and background tasks.
    """
    session = AsyncWriteSession()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


# ─────────────────────────────────────────────────────────────────────────────
# Lifecycle helpers (call from app lifespan)
# ─────────────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """
    Called once at startup.  Runs a cheap connectivity check.
    """
    async with engine_write.connect() as conn:
        result = await conn.execute(text("SELECT version()"))
        ver = result.scalar()
        logger.info("PostgreSQL connected: %s", ver)
    logger.info(
        "Write pool: size=%d overflow=%d timeout=%ds",
        settings.DB_POOL_SIZE,
        settings.DB_MAX_OVERFLOW,
        settings.DB_POOL_TIMEOUT,
    )


async def close_db() -> None:
    """Gracefully drain the connection pool on shutdown."""
    await engine_write.dispose()
    await engine_read.dispose()
    logger.info("Database connection pools closed.")


# ─────────────────────────────────────────────────────────────────────────────
# Connection event hooks
# ─────────────────────────────────────────────────────────────────────────────
# NOTE: We deliberately do NOT use the sync `@event.listens_for(..., "connect")`
# pattern here — it runs raw DB-API cursor operations which don't work safely
# with asyncpg.  Instead, any per-connection setup goes inside asyncpg
# server_settings (passed in connect_args above) which asyncpg applies during
# the handshake, before any query runs.
#
# `search_path` is `public` by default in PostgreSQL — no explicit setting
# needed.  If you need a different schema, set it via:
#   ALTER DATABASE edu_monitoring SET search_path TO public, audit;
