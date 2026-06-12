"""
crud/base.py
─────────────────────────────────────────────────────────────────────────────
Generic async CRUD base that each domain module inherits from.

Design goals
────────────
  • Eliminate the ~80% of CRUD code that is identical across every domain
    table (list, get_by_id, upsert, soft_delete, change_status).
  • Keep domain-specific validation in the concrete subclass.
  • Every method is typed; the generic T is the SQLAlchemy model class.

How to use
──────────
    class ScienceCRUD(BaseCRUD[ScienceActivity]):
        MODEL = ScienceActivity
        UNIQUE_CONSTRAINT = "uq_science_org_year"
        UNIQUE_FIELDS = ("org_id", "period_year")
        CACHE_NAMESPACE = "science"

    science_crud = ScienceCRUD()

    # In router:
    record = await science_crud.get(db, record_id=1, org_id=org_id)
    records, total = await science_crud.list(db, org_id=org_id)
    record, created = await science_crud.upsert(db, org_id=org_id, data=body, actor_id=uid)

State machine
─────────────
    All domain tables share the same submission workflow state machine.
    The transitions dict is defined on the base class and can be overridden.
"""
from __future__ import annotations

import logging
from typing import Any, Generic, Optional, Type, TypeVar
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import get_cached, invalidate_org_cache, set_cached
from app.schemas.science import StatusChangeRequest

logger = logging.getLogger(__name__)

# SQLAlchemy model type variable
T = TypeVar("T")

# ─────────────────────────────────────────────────────────────────────────────
# Shared state machine (used by all domain tables)
# ─────────────────────────────────────────────────────────────────────────────

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft":        {"submitted"},
    "submitted":    {"under_review", "rejected"},
    "under_review": {"approved", "rejected"},
    "approved":     set(),          # terminal
    "rejected":     {"draft"},
}

DATA_ENTRY_WRITABLE = {"draft", "submitted", "rejected"}


def assert_transition(current: str, desired: str, *, is_admin: bool) -> None:
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if desired not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status transition: {current!r} → {desired!r}. "
                f"Allowed from {current!r}: {sorted(allowed) or '(terminal state)'}"
            ),
        )
    if not is_admin and desired not in {"draft", "submitted"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can set this submission status.",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Generic CRUD base
# ─────────────────────────────────────────────────────────────────────────────

class BaseCRUD(Generic[T]):
    """
    Generic async CRUD operations.

    Subclass and set the class-level attributes:
        MODEL              — SQLAlchemy model class
        UNIQUE_CONSTRAINT  — name of the DB UNIQUE constraint (for upsert)
        UNIQUE_FIELDS      — tuple of field names in the unique key
        CACHE_NAMESPACE    — prefix for Redis cache keys
    """

    MODEL: Type[T]
    UNIQUE_CONSTRAINT: str
    UNIQUE_FIELDS: tuple[str, ...]
    CACHE_NAMESPACE: str = "base"
    CACHE_TTL: int = settings.CACHE_DEFAULT_TTL

    # ─── READ ──────────────────────────────────────────────────────────────

    async def get(
        self,
        db: AsyncSession,
        *,
        record_id: int,
        org_id: Optional[UUID] = None,
    ) -> T:
        """
        Fetch by primary key.  Optionally filter by org_id (second safety net
        after RLS).  Raises 404 if not found or soft-deleted.
        """
        model = self.MODEL
        stmt = select(model).where(
            model.id == record_id,
            model.deleted_at.is_(None),
        )
        if org_id is not None:
            stmt = stmt.where(model.org_id == org_id)

        result = await db.execute(stmt)
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{model.__tablename__} record {record_id} not found.",
            )
        return row

    async def list(
        self,
        db: AsyncSession,
        *,
        org_id: UUID,
        submission_status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        extra_filters: Optional[list] = None,
    ) -> tuple[list[T], int]:
        """
        Paginated list for one org.
        Returns (items, total_count).
        Results are Redis-cached.
        """
        model = self.MODEL

        cache_key = (org_id, submission_status, limit, offset,
                     str(extra_filters or ""))
        cached = await get_cached(self.CACHE_NAMESPACE, *cache_key)
        if cached:
            return [model(**row) for row in cached["items"]], cached["total"]

        base_filter = [model.org_id == org_id, model.deleted_at.is_(None)]
        if submission_status:
            base_filter.append(model.submission_status == submission_status)
        if extra_filters:
            base_filter.extend(extra_filters)

        total: int = (
            await db.execute(
                select(func.count()).select_from(model).where(*base_filter)
            )
        ).scalar_one()

        rows = (
            await db.execute(
                select(model)
                .where(*base_filter)
                .order_by(model.id.desc())
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()

        # Cheap serialisation for cache — only store primitive columns
        await set_cached(
            self.CACHE_NAMESPACE,
            {"items": [self._to_cache_dict(r) for r in rows], "total": total},
            *cache_key,
            ttl=self.CACHE_TTL,
        )
        return list(rows), total

    # ─── WRITE ─────────────────────────────────────────────────────────────

    async def upsert(
        self,
        db: AsyncSession,
        *,
        org_id: UUID,
        data: Any,               # Pydantic Create schema with .to_db_dict()
        actor_id: str,
    ) -> tuple[T, bool]:
        """
        Atomic upsert using PostgreSQL INSERT … ON CONFLICT DO UPDATE.
        Returns (record, created: bool).

        This is the preferred write path for form submissions:
          - Atomic: no SELECT-then-INSERT race condition.
          - Idempotent: re-submitting the same (org_id, year/date) is safe.
          - JSONB: asyncpg handles dict → JSONB automatically.
        """
        model = self.MODEL
        db_dict = data.to_db_dict()
        db_dict["org_id"] = org_id

        update_cols = {
            k: v for k, v in db_dict.items()
            if k not in {*self.UNIQUE_FIELDS, "created_at", "created_by"}
        }
        update_cols.update({"updated_by": actor_id, "updated_at": func.now()})

        stmt = (
            pg_insert(model)
            .values(**db_dict, created_by=actor_id, updated_by=actor_id)
            .on_conflict_do_update(
                constraint=self.UNIQUE_CONSTRAINT,
                set_=update_cols,
            )
            .returning(model)
        )

        try:
            async with db.begin():
                result = await db.execute(stmt)
                record = result.scalar_one()
        except IntegrityError as exc:
            logger.exception("Upsert IntegrityError on %s", model.__tablename__)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Database integrity error: {exc.orig}",
            )

        created = record.version == 1
        await invalidate_org_cache(str(org_id))
        return record, created

    async def update(
        self,
        db: AsyncSession,
        *,
        record_id: int,
        org_id: UUID,
        data: Any,               # Pydantic Update schema with .to_db_dict() + .version
        actor_id: str,
        is_admin: bool = False,
    ) -> T:
        """
        Partial update with optimistic locking.
        Raises 409 if the version has changed since the client's last GET.
        """
        model = self.MODEL
        record = await self.get(db, record_id=record_id, org_id=org_id)

        if record.submission_status == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Approved records are immutable.",
            )
        if not is_admin and record.submission_status not in DATA_ENTRY_WRITABLE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can edit records not in draft/rejected status.",
            )

        if getattr(data, "submission_status", None):
            assert_transition(
                record.submission_status, data.submission_status, is_admin=is_admin
            )

        updates = data.to_db_dict()
        updates["updated_by"] = actor_id

        stmt = (
            update(model)
            .where(
                model.id == record_id,
                model.version == data.version,
                model.deleted_at.is_(None),
            )
            .values(**updates, version=model.version + 1)
            .returning(model)
        )

        async with db.begin():
            result = await db.execute(stmt)
            updated = result.scalar_one_or_none()

        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Concurrent modification detected. "
                    f"Expected version {data.version} is stale. "
                    "Reload the record and retry."
                ),
            )

        await invalidate_org_cache(str(org_id))
        return updated

    async def change_status(
        self,
        db: AsyncSession,
        *,
        record_id: int,
        org_id: UUID,
        data: StatusChangeRequest,
        actor_id: str,
    ) -> T:
        """Admin-only status transition."""
        model = self.MODEL
        record = await self.get(db, record_id=record_id, org_id=org_id)
        assert_transition(record.submission_status, data.new_status, is_admin=True)

        async with db.begin():
            stmt = (
                update(model)
                .where(model.id == record_id)
                .values(
                    submission_status=data.new_status,
                    updated_by=actor_id,
                    version=model.version + 1,
                )
                .returning(model)
            )
            result = await db.execute(stmt)
            updated = result.scalar_one()

        await invalidate_org_cache(str(org_id))
        logger.info(
            "%s status changed: id=%d %s→%s actor=%s",
            model.__tablename__,
            record_id,
            record.submission_status,
            data.new_status,
            actor_id,
        )
        return updated

    async def soft_delete(
        self,
        db: AsyncSession,
        *,
        record_id: int,
        org_id: UUID,
        actor_id: str,
    ) -> None:
        """Logical deletion — sets deleted_at / deleted_by."""
        model = self.MODEL
        record = await self.get(db, record_id=record_id, org_id=org_id)

        if record.submission_status == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Approved records cannot be deleted.",
            )

        async with db.begin():
            await db.execute(
                update(model)
                .where(model.id == record_id)
                .values(
                    deleted_at=func.now(),
                    deleted_by=actor_id,
                    updated_by=actor_id,
                )
            )
        await invalidate_org_cache(str(org_id))

    # ─── Helpers ───────────────────────────────────────────────────────────

    def _to_cache_dict(self, record: T) -> dict[str, Any]:
        """Lightweight dict for cache storage — avoids full Pydantic serialisation."""
        from sqlalchemy import inspect as sa_inspect
        insp = sa_inspect(record)
        out: dict[str, Any] = {}
        for col in insp.mapper.column_attrs:
            val = getattr(record, col.key)
            if hasattr(val, "isoformat"):   # datetime / date
                val = val.isoformat()
            elif hasattr(val, "__str__") and type(val).__name__ in ("UUID", "Decimal"):
                val = str(val)
            out[col.key] = val
        return out
