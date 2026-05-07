"""
migrations/env.py
─────────────────────────────────────────────────────────────────────────────
Alembic async migration environment.

Setup:
    alembic init -t async migrations
    # Replace migrations/env.py with this file.

Generate a migration:
    alembic revision --autogenerate -m "add_science_activity"

Apply:
    alembic upgrade head

Rollback one step:
    alembic downgrade -1

Why async Alembic?
    Our SQLAlchemy engine uses asyncpg.  Alembic requires a synchronous
    connection for DDL commands (ALTER TABLE, CREATE INDEX, etc.).
    The `run_migrations_online` function bridges async→sync using
    `connectable.sync_connection()`.
"""
from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Import ALL models so Alembic sees them for --autogenerate
from app.core.database import Base
from app.models.science import ScienceActivity        # noqa: F401
from app.models.contingent import ContingentSnapshot  # noqa: F401
from app.models.finance import FinanceRecord          # noqa: F401
from app.models.graduates import GraduatesRecord      # noqa: F401
from app.models.education import EducationalProcess   # noqa: F401
from app.models.user import User, RefreshToken        # noqa: F401  (native auth)
from app.models.organization import Organization, OrgType, Region, Locality, OwnershipForm, OrgKind, DataSource, ApiToken  # noqa: F401

from app.core.config import settings

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
