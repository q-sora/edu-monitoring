"""
models/mixins.py
─────────────────────────────────────────────────────────────────────────────
SQLAlchemy 2.0 declarative mixins for government-grade data integrity.

Mixins provided
───────────────
  TimestampMixin   — created_at / updated_at columns with DB-default NOW()
  AuditMixin       — extends Timestamp with updated_by (user UUID) and
                     version (optimistic lock counter)
  SoftDeleteMixin  — deleted_at / deleted_by for logical deletion
  FullAuditMixin   — composes all three above; the recommended default for
                     any table that holds submission data

  AuditEventListener — SQLAlchemy event hooks that:
                        • write a row to audit_log after INSERT/UPDATE/DELETE
                        • pull the actor UUID from a Python context var that
                          the auth dependency sets per-request

IMPORTANT production notes
──────────────────────────
  1. Version auto-increment is done in the CRUD layer (via `.values(version=Model.version+1)`),
     NOT in the event listener.  Combining both creates a race condition with
     optimistic locking — the WHERE version=:expected and the SET version+=1
     would double-increment.  The listener ONLY records the audit entry.

  2. Audit INSERTs are done via raw SQL `session.execute(text(...))` — this
     bypasses the ORM, avoiding the recursion trap where the listener would
     fire on its own inserts.

  3. Decimal values are converted to str in _serialise_instance — json.dumps
     does not accept Decimal natively.

  4. JSONB columns pass Python dict/list directly to asyncpg; the driver
     serialises to PostgreSQL binary format.  We do NOT call json.dumps on
     those — but for audit_log we DO call json.dumps since we're using raw
     `:jsonb` text casts inside the INSERT statement.
"""
from __future__ import annotations

import contextvars
import json
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    DateTime,
    String,
    Text,
    event,
    func,
    inspect,
    text as sa_text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column

# Direct import is safe: database.py imports only from sqlalchemy + app.core.config,
# never from app.models — so there is zero circular dependency risk.
from app.core.database import Base

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Context variable — set by auth dependency before any DB operation
# ─────────────────────────────────────────────────────────────────────────────

#: Holds the authenticated user's UUID as a string for the duration of the request.
current_user_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_user_id", default=None
)

#: Holds the authenticated user's org_id as a string.
current_org_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_org_id", default=None
)

#: Re-entry guard so our own INSERT INTO audit_log does not trigger another
#: after_flush loop.  Each coroutine / thread has its own flag.
_audit_recursion_guard: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "_audit_recursion_guard", default=False
)


def _get_actor() -> str:
    """Resolves the current user UUID; falls back to 'system' for Celery tasks."""
    return current_user_id.get() or "system"


# ─────────────────────────────────────────────────────────────────────────────
# Timestamp mixin
# ─────────────────────────────────────────────────────────────────────────────

class TimestampMixin:
    """
    Adds created_at and updated_at to every model.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="Row creation timestamp (UTC)",
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
        comment="Last modification timestamp (UTC); refreshed on every UPDATE",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Audit mixin — adds actor + optimistic lock
# ─────────────────────────────────────────────────────────────────────────────

class AuditMixin(TimestampMixin):
    """
    Extends TimestampMixin with:
        created_by  — UUID of the user who created the row
        updated_by  — UUID of the user who last modified the row
        version     — monotonically increasing integer for optimistic locking

    Optimistic locking protocol:
        CRUD layer does `WHERE version = :expected_version` AND
        `.values(version = Model.version + 1)` in the same UPDATE.
        The event listener does NOT touch `version` — doing so would race
        with the WHERE clause and break optimistic locking.
    """

    created_by: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        comment="User UUID who created this row",
    )
    updated_by: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        comment="User UUID who last modified this row",
    )
    version: Mapped[int] = mapped_column(
        default=1,
        server_default="1",
        nullable=False,
        comment="Optimistic lock counter; incremented explicitly in CRUD UPDATEs",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Soft-delete mixin
# ─────────────────────────────────────────────────────────────────────────────

class SoftDeleteMixin:
    """
    Adds deleted_at / deleted_by.
    Queries must include WHERE deleted_at IS NULL to exclude soft-deleted rows.
    """

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="Set to NOW() on logical deletion; NULL means live row",
    )
    deleted_by: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        comment="User UUID who performed the logical deletion",
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self, actor_id: Optional[str] = None) -> None:
        self.deleted_at = datetime.now(timezone.utc)
        self.deleted_by = actor_id or _get_actor()


class FullAuditMixin(AuditMixin, SoftDeleteMixin):
    """Composes AuditMixin + SoftDeleteMixin."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Audit log ORM model
# ─────────────────────────────────────────────────────────────────────────────

class AuditLog(Base):
    """
    Standalone audit_log table model.
    Written by the AuditEventListener; never written by application code directly.
    Matches the CREATE TABLE audit_log definition in edu_monitoring_schema.sql.
    """
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    table_name: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    record_id: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(String(10), nullable=False)   # INSERT/UPDATE/DELETE
    changed_by: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    org_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True, index=True)
    old_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    new_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


# ─────────────────────────────────────────────────────────────────────────────
# Serialisation helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_value(val: Any) -> Any:
    """Convert Python value to something json.dumps can handle."""
    if val is None:
        return None
    if isinstance(val, (UUID, Decimal)):
        return str(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    # bytes → hex; dict/list pass through and json.dumps recurses
    if isinstance(val, bytes):
        return val.hex()
    return val


def _serialise_instance(instance: object) -> dict:
    """
    Snapshot ORM instance to a plain dict suitable for JSONB storage.
    Handles UUID, datetime, date, and Decimal types that json.dumps cannot.
    """
    try:
        insp = inspect(instance)
    except Exception:
        return {}

    result: dict = {}
    for col in insp.mapper.column_attrs:
        try:
            val = getattr(instance, col.key)
        except Exception:
            # e.g. unloaded relationship — skip
            continue
        # Never log password hashes
        if col.key in {"password_hash", "token_hash"}:
            result[col.key] = "***"
            continue
        result[col.key] = _safe_value(val)
    return result


def _get_record_id(instance: object) -> str:
    """Extract primary-key value as string."""
    try:
        insp = inspect(instance)
    except Exception:
        return "unknown"
    pk_values = [
        getattr(instance, col.key, None)
        for col in insp.mapper.primary_key
    ]
    return ":".join(str(v) if v is not None else "null" for v in pk_values)


def _get_org_id(instance: object) -> Optional[str]:
    """Safely read org_id if the model has one."""
    val = getattr(instance, "org_id", None)
    return str(val) if val else None


# ─────────────────────────────────────────────────────────────────────────────
# Audit event listener
# ─────────────────────────────────────────────────────────────────────────────

class AuditEventListener:
    """Writes an audit_log row for every INSERT/UPDATE/DELETE."""

    @staticmethod
    def after_flush(session: Session, flush_context: object) -> None:
        """
        Fires inside the transaction after every flush (before commit).
        Collects new/changed/deleted instances and writes audit rows.

        Recursion guard: our own raw INSERT into audit_log triggers another
        after_flush.  The guard prevents the listener from re-entering for
        its own writes.

        Exception safety: any error here must NOT take down the whole
        transaction — audit is important but secondary to the user's write.
        We log and swallow.
        """
        # Re-entry check: if the listener is already running on this flush, skip
        if _audit_recursion_guard.get():
            return

        try:
            actor = _get_actor()
            audit_rows: list[dict] = []

            for instance in session.new:
                if isinstance(instance, AuditLog):
                    continue
                audit_rows.append({
                    "table_name": instance.__tablename__,
                    "record_id":  _get_record_id(instance),
                    "action":     "INSERT",
                    "changed_by": actor,
                    "org_id":     _get_org_id(instance),
                    "old_data":   None,
                    "new_data":   _serialise_instance(instance),
                })

            for instance in session.dirty:
                if isinstance(instance, AuditLog):
                    continue
                if not session.is_modified(instance):
                    continue
                history: dict = {}
                try:
                    insp = inspect(instance)
                    for col in insp.mapper.column_attrs:
                        hist = insp.attrs[col.key].history
                        if hist.deleted:
                            history[col.key] = _safe_value(hist.deleted[0])
                except Exception:
                    pass

                audit_rows.append({
                    "table_name": instance.__tablename__,
                    "record_id":  _get_record_id(instance),
                    "action":     "UPDATE",
                    "changed_by": actor,
                    "org_id":     _get_org_id(instance),
                    "old_data":   history or None,
                    "new_data":   _serialise_instance(instance),
                })

            for instance in session.deleted:
                if isinstance(instance, AuditLog):
                    continue
                audit_rows.append({
                    "table_name": instance.__tablename__,
                    "record_id":  _get_record_id(instance),
                    "action":     "DELETE",
                    "changed_by": actor,
                    "org_id":     _get_org_id(instance),
                    "old_data":   _serialise_instance(instance),
                    "new_data":   None,
                })

            if not audit_rows:
                return

            # Guard on, write audit rows with raw SQL, guard off.
            token = _audit_recursion_guard.set(True)
            try:
                session.execute(
                    sa_text(
                        """
                        INSERT INTO audit_log
                            (table_name, record_id, action, changed_by, org_id,
                             old_data, new_data)
                        VALUES
                            (:table_name, :record_id, :action, :changed_by, :org_id,
                             CAST(:old_data AS JSONB), CAST(:new_data AS JSONB))
                        """
                    ),
                    [
                        {
                            **row,
                            "old_data": json.dumps(row["old_data"], ensure_ascii=False)
                                        if row["old_data"] is not None else None,
                            "new_data": json.dumps(row["new_data"], ensure_ascii=False)
                                        if row["new_data"] is not None else None,
                        }
                        for row in audit_rows
                    ],
                )
            finally:
                _audit_recursion_guard.reset(token)

        except Exception as exc:
            # Audit must never crash the user's transaction
            logger.exception("Audit listener failed (write continues): %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Register audit listener globally on the write session factory
# ─────────────────────────────────────────────────────────────────────────────

_hooks_registered = False


def register_audit_hooks() -> None:
    """
    Call once at application startup.

    Idempotent: safe to call multiple times (important for test fixtures that
    may import main.py more than once).
    """
    global _hooks_registered
    if _hooks_registered:
        return

    event.listen(
        Session,
        "after_flush",
        AuditEventListener.after_flush,
    )
    _hooks_registered = True
    logger.info("Audit trail hooks registered on Session class.")
