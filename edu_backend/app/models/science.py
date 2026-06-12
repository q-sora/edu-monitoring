"""
models/science.py
─────────────────────────────────────────────────────────────────────────────
SQLAlchemy 2.0 ORM model for the science_activity table.

Column names match edu_monitoring_schema.sql exactly.
JSONB columns use sqlalchemy.dialects.postgresql.JSONB for proper asyncpg
binary serialisation (no manual json.dumps / json.loads required).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import FullAuditMixin


class ScienceActivity(FullAuditMixin, Base):
    """
    Научная деятельность — maps to: science_activity

    UNIQUE constraint: (org_id, period_year)
    JSONB columns: grants_json, student_projects_json

    Inherits from FullAuditMixin:
        created_at, updated_at, created_by, updated_by, version,
        deleted_at, deleted_by
    """

    __tablename__ = "science_activity"
    __table_args__ = (
        UniqueConstraint("org_id", "period_year", name="uq_science_org_year"),
        # Partial index — active rows only; fast for org-scoped lookups
        Index(
            "ix_science_active",
            "org_id",
            "period_year",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        # GIN index for JSONB search (e.g. find orgs with grants in "IT" direction)
        Index("ix_science_grants_gin", "grants_json", postgresql_using="gin"),
        Index("ix_science_projects_gin", "student_projects_json", postgresql_using="gin"),
    )

    # ── Primary key ────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Foreign keys ───────────────────────────────────────────────────────
    org_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent organisation; RLS key",
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("data_sources.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Period ─────────────────────────────────────────────────────────────
    period_year: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        comment="Reporting year — forms part of the UNIQUE key with org_id",
    )

    # ── JSONB fields ───────────────────────────────────────────────────────
    # asyncpg + SQLAlchemy JSONB:
    #   • Python dict/list is passed directly to asyncpg.
    #   • asyncpg serialises to PostgreSQL JSONB binary format.
    #   • NO manual json.dumps() — doing so stores a string, not a JSONB object.
    grants_json: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSONB,
        nullable=True,
        comment=(
            "Array of grant objects: "
            "[{title, amount, direction, duration_years}, ...]"
        ),
    )
    student_projects_json: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Array of student project objects: [{title, stage, funding}, ...]",
    )

    # ── Scalar analytics ───────────────────────────────────────────────────
    hirsch_index_avg: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    hirsch_index_max: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    publications_q1: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    publications_q2: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    publications_q3: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    publications_q4: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    publications_scopus: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    publications_wos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── Submission workflow ────────────────────────────────────────────────
    submission_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="draft",
        comment="State machine: draft → submitted → under_review → approved / rejected",
    )

    # ── Relationships (lazy="noload" for async safety) ─────────────────────
    # organisation: Mapped["Organisation"] = relationship(back_populates="science_activities", lazy="noload")
