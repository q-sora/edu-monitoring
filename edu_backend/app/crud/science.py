"""
crud/science.py
─────────────────────────────────────────────────────────────────────────────
Async CRUD operations for science_activity.

Transaction strategy
────────────────────
  Every write function opens an explicit transaction with `async with db.begin()`.
  On success → commit.  On any exception → automatic rollback.
  We do NOT use `session.commit()` at the route layer — the CRUD layer owns
  transaction boundaries to keep routes thin and testable.

Optimistic locking
──────────────────
  UPDATE queries include `WHERE id = :id AND version = :expected_version`.
  If 0 rows affected, we raise a 409 Conflict.  This prevents the "lost update"
  problem when two admin users approve/modify the same record concurrently.

JSONB handling
──────────────
  asyncpg natively understands Python dicts and lists for JSONB columns.
  We pass them directly inside a SQLAlchemy `Values()` mapping.
  Never call json.dumps() on a value going into a Mapped[JSONB] column —
  that would store a quoted-string literal instead of a proper JSONB object.

Cache invalidation
──────────────────
  After every write, we invalidate the relevant cache keys for this org.
  Reads use a short TTL (5 min default) so stale data self-heals even if
  the invalidation fails.

Submission state machine
────────────────────────
  Allowed transitions:
      draft       → submitted
      submitted   → under_review | rejected
      under_review→ approved | rejected
      approved    → (terminal — no transitions allowed)
      rejected    → draft

  The CRUD layer enforces these transitions.  A data_entry user can only
  move draft → submitted.  Admin can move submitted → approved / rejected.
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.redis_client import get_cached, invalidate_org_cache, set_cached
from app.core.config import settings
from app.models.science import ScienceActivity
from app.models.mixins import current_user_id
from app.schemas.science import (
    ScienceActivityCreate,
    ScienceActivityResponse,
    ScienceActivityUpdate,
    StatusChangeRequest,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# State machine
# ─────────────────────────────────────────────────────────────────────────────

_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft":        {"submitted"},
    "submitted":    {"under_review", "rejected"},
    "under_review": {"approved", "rejected"},
    "approved":     set(),          # terminal
    "rejected":     {"draft"},
}

_DATA_ENTRY_ALLOWED: set[str] = {"submitted", "draft"}  # data_entry can only set these


def _assert_transition(current: str, desired: str, is_admin: bool) -> None:
    allowed = _ALLOWED_TRANSITIONS.get(current, set())
    if desired not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status transition: {current!r} → {desired!r}. "
                f"Allowed from {current!r}: {sorted(allowed) or '(terminal)'}"
            ),
        )
    if not is_admin and desired not in _DATA_ENTRY_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can set this submission status.",
        )


# ─────────────────────────────────────────────────────────────────────────────
# READ operations
# ─────────────────────────────────────────────────────────────────────────────

async def get_science_activity(
    db: AsyncSession,
    *,
    record_id: int,
    org_id: Optional[UUID] = None,   # pass to enforce org isolation at DB level
) -> ScienceActivity:
    """
    Fetch a single record by primary key.
    If org_id is supplied, adds it as a WHERE clause (second safety net after RLS).

    Raises 404 if not found or soft-deleted.
    """
    stmt = (
        select(ScienceActivity)
        .where(
            ScienceActivity.id == record_id,
            ScienceActivity.deleted_at.is_(None),
        )
    )
    if org_id:
        stmt = stmt.where(ScienceActivity.org_id == org_id)

    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Science activity record {record_id} not found.",
        )
    return record


async def list_science_activity(
    db: AsyncSession,
    *,
    org_id: UUID,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    submission_status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[ScienceActivity], int]:
    """
    Paginated list for one org.
    Returns (items, total_count) tuple.
    Results are cached in Redis for `CACHE_DEFAULT_TTL` seconds.

    Cache key encodes all filter params so different filter combos get
    independent cache entries.
    """
    cache_key_parts = (org_id, year_from, year_to, submission_status, limit, offset)

    # ── Cache hit ─────────────────────────────────────────────────────────
    cached = await get_cached("science_list", *cache_key_parts)
    if cached:
        return (
            [ScienceActivity(**row) for row in cached["items"]],
            cached["total"],
        )

    # ── DB query ──────────────────────────────────────────────────────────
    base_filter = [
        ScienceActivity.org_id == org_id,
        ScienceActivity.deleted_at.is_(None),
    ]
    if year_from:
        base_filter.append(ScienceActivity.period_year >= year_from)
    if year_to:
        base_filter.append(ScienceActivity.period_year <= year_to)
    if submission_status:
        base_filter.append(ScienceActivity.submission_status == submission_status)

    count_stmt = select(func.count()).select_from(ScienceActivity).where(*base_filter)
    total: int = (await db.execute(count_stmt)).scalar_one()

    list_stmt = (
        select(ScienceActivity)
        .where(*base_filter)
        .order_by(ScienceActivity.period_year.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(list_stmt)).scalars().all()

    # ── Cache store ───────────────────────────────────────────────────────
    await set_cached(
        "science_list",
        {
            "items": [ScienceActivityResponse.model_validate(r).model_dump(mode="json") for r in rows],
            "total": total,
        },
        *cache_key_parts,
        ttl=settings.CACHE_DEFAULT_TTL,
    )

    return list(rows), total


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

async def create_science_activity(
    db: AsyncSession,
    *,
    org_id: UUID,
    data: ScienceActivityCreate,
    actor_id: str,
) -> ScienceActivity:
    """
    Insert a new science_activity row (or upsert if the year already exists).

    Transaction:
        async with db.begin() wraps the INSERT.  If the UNIQUE constraint fires
        (duplicate org_id + period_year), we convert the IntegrityError to a
        clean HTTP 409.

    JSONB:
        data.to_db_dict() converts GrantItem / StudentProjectItem Pydantic
        models to plain Python dicts.  asyncpg serialises them to JSONB.
        We NEVER call json.dumps() here.

    Audit:
        The AuditEventListener attached to the session's after_flush event
        automatically writes to audit_log inside the same transaction.
    """
    db_dict = data.to_db_dict()
    db_dict["org_id"] = org_id
    db_dict["created_by"] = actor_id
    db_dict["updated_by"] = actor_id

    record = ScienceActivity(**db_dict)

    try:
        async with db.begin():
            db.add(record)
            await db.flush()   # get the generated id before commit
            await db.refresh(record)
    except IntegrityError as exc:
        # UNIQUE(org_id, period_year) violated → upsert or conflict
        if "uq_science_org_year" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"A science activity record for org {org_id} "
                    f"year {data.period_year} already exists. "
                    "Use PATCH to update it."
                ),
            )
        logger.exception("Unexpected IntegrityError on science activity create")
        raise HTTPException(status_code=500, detail="Database integrity error")

    # Invalidate list cache for this org
    await invalidate_org_cache(str(org_id))

    logger.info(
        "Science activity created: id=%d org=%s year=%d actor=%s",
        record.id,
        org_id,
        data.period_year,
        actor_id,
    )
    return record


# ─────────────────────────────────────────────────────────────────────────────
# UPSERT (create-or-update) — preferred for form submissions
# ─────────────────────────────────────────────────────────────────────────────

async def upsert_science_activity(
    db: AsyncSession,
    *,
    org_id: UUID,
    data: ScienceActivityCreate,
    actor_id: str,
) -> tuple[ScienceActivity, bool]:
    """
    Create-or-update for (org_id, period_year).
    Returns (record, created: bool).

    Uses PostgreSQL INSERT … ON CONFLICT DO UPDATE via SQLAlchemy's
    `insert().on_conflict_do_update()` for atomicity under concurrent load.
    This avoids the SELECT-then-INSERT race condition.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    db_dict = data.to_db_dict()
    db_dict["org_id"] = org_id

    # Columns to update on conflict (everything except PK + created_at + created_by)
    update_cols = {
        k: v for k, v in db_dict.items()
        if k not in {"org_id", "period_year", "created_at", "created_by"}
    }
    update_cols["updated_by"] = actor_id
    update_cols["updated_at"] = func.now()

    stmt = (
        pg_insert(ScienceActivity)
        .values(**db_dict, created_by=actor_id, updated_by=actor_id)
        .on_conflict_do_update(
            constraint="uq_science_org_year",
            set_=update_cols,
        )
        .returning(ScienceActivity)
    )

    async with db.begin():
        result = await db.execute(stmt)
        record = result.scalar_one()

    created = record.version == 1
    await invalidate_org_cache(str(org_id))

    logger.info(
        "Science activity upserted: id=%d org=%s year=%d created=%s actor=%s",
        record.id,
        org_id,
        data.period_year,
        created,
        actor_id,
    )
    return record, created


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE with optimistic locking
# ─────────────────────────────────────────────────────────────────────────────

async def update_science_activity(
    db: AsyncSession,
    *,
    record_id: int,
    org_id: UUID,
    data: ScienceActivityUpdate,
    actor_id: str,
    is_admin: bool = False,
) -> ScienceActivity:
    """
    Partial update with optimistic locking.

    1. Fetch current record (raises 404 if missing or soft-deleted).
    2. Validate the record is editable (draft only for data_entry; admin can edit submitted).
    3. Validate state-machine transition if submission_status is being changed.
    4. UPDATE with WHERE version = :expected — raises 409 on stale version.
    5. Audit trail written by event listener.

    Optimistic locking prevents this scenario:
        User A reads record at version=3
        User B reads record at version=3
        User A updates → version becomes 4
        User B tries to update with version=3 → 0 rows affected → 409
    """
    # ── 1. Fetch ──────────────────────────────────────────────────────────
    record = await get_science_activity(db, record_id=record_id, org_id=org_id)

    # ── 2. Editability check ──────────────────────────────────────────────
    if record.submission_status == "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approved records are immutable.",
        )
    if not is_admin and record.submission_status not in {"draft", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can edit records in submitted/under_review status.",
        )

    # ── 3. State machine ──────────────────────────────────────────────────
    if data.submission_status:
        _assert_transition(record.submission_status, data.submission_status, is_admin)

    # ── 4. Optimistic-lock UPDATE ─────────────────────────────────────────
    updates = data.to_db_dict()
    updates["updated_by"] = actor_id

    stmt = (
        update(ScienceActivity)
        .where(
            ScienceActivity.id == record_id,
            ScienceActivity.version == data.version,   # optimistic lock
            ScienceActivity.deleted_at.is_(None),
        )
        .values(**updates, version=ScienceActivity.version + 1)
        .returning(ScienceActivity)
    )

    async with db.begin():
        result = await db.execute(stmt)
        updated = result.scalar_one_or_none()

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Concurrent modification detected. "
                f"Record version {data.version} no longer matches. "
                "Please reload and retry."
            ),
        )

    await invalidate_org_cache(str(org_id))

    logger.info(
        "Science activity updated: id=%d actor=%s new_version=%d",
        record_id,
        actor_id,
        updated.version,
    )
    return updated


# ─────────────────────────────────────────────────────────────────────────────
# STATUS CHANGE (approve / reject — admin only)
# ─────────────────────────────────────────────────────────────────────────────

async def change_submission_status(
    db: AsyncSession,
    *,
    record_id: int,
    org_id: UUID,
    data: StatusChangeRequest,
    actor_id: str,
) -> ScienceActivity:
    """
    Admin-only status transition.  Logs the reviewer's comment to audit_log
    via the FullAuditMixin event listener (captured in `new_data.comment`).
    """
    record = await get_science_activity(db, record_id=record_id, org_id=org_id)
    _assert_transition(record.submission_status, data.new_status, is_admin=True)

    async with db.begin():
        stmt = (
            update(ScienceActivity)
            .where(ScienceActivity.id == record_id)
            .values(
                submission_status=data.new_status,
                updated_by=actor_id,
                version=ScienceActivity.version + 1,
            )
            .returning(ScienceActivity)
        )
        result = await db.execute(stmt)
        updated = result.scalar_one()

    await invalidate_org_cache(str(org_id))
    logger.info(
        "Science activity status changed: id=%d %s→%s actor=%s",
        record_id,
        record.submission_status,
        data.new_status,
        actor_id,
    )
    return updated


# ─────────────────────────────────────────────────────────────────────────────
# SOFT DELETE
# ─────────────────────────────────────────────────────────────────────────────

async def soft_delete_science_activity(
    db: AsyncSession,
    *,
    record_id: int,
    org_id: UUID,
    actor_id: str,
) -> None:
    """
    Logical deletion — sets deleted_at / deleted_by.
    Only approved records cannot be deleted.
    Government data is NEVER physically deleted.
    """
    record = await get_science_activity(db, record_id=record_id, org_id=org_id)

    if record.submission_status == "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approved records cannot be deleted.",
        )

    async with db.begin():
        stmt = (
            update(ScienceActivity)
            .where(ScienceActivity.id == record_id)
            .values(
                deleted_at=func.now(),
                deleted_by=actor_id,
                updated_by=actor_id,
            )
        )
        await db.execute(stmt)

    await invalidate_org_cache(str(org_id))
    logger.info("Science activity soft-deleted: id=%d actor=%s", record_id, actor_id)
