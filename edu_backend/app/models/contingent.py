"""
models/contingent.py — contingent_snapshots ORM model
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import FullAuditMixin


class ContingentSnapshot(FullAuditMixin, Base):
    """
    Контингент студентов — maps to: contingent_snapshots
    UNIQUE(org_id, snapshot_date)
    """

    __tablename__ = "contingent_snapshots"
    __table_args__ = (
        UniqueConstraint("org_id", "snapshot_date", name="uq_contingent_org_date"),
        Index(
            "ix_contingent_active",
            "org_id",
            "snapshot_date",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        # Accelerates queries like "get latest snapshot for org"
        Index("ix_contingent_org_date", "org_id", "snapshot_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True
    )

    snapshot_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="Date this snapshot was taken (unique key with org_id)"
    )

    # ── Core counts ────────────────────────────────────────────────────────
    total_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    new_enrolled: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    withdrawn: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── By level (ВиПО / ТиППО) ───────────────────────────────────────────
    bachelor_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    master_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    phd_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    full_time_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    distance_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    budget_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    paid_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── JSONB breakdowns ───────────────────────────────────────────────────
    by_grade_json: Mapped[Optional[dict[str, int]]] = mapped_column(JSONB, nullable=True)
    by_specialty_json: Mapped[Optional[dict[str, int]]] = mapped_column(JSONB, nullable=True)
    prize_winners_json: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(JSONB, nullable=True)

    # ── By language ───────────────────────────────────────────────────────
    kz_lang_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ru_lang_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    en_lang_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    other_lang_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── Privileged categories ─────────────────────────────────────────────
    many_children_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    low_income_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    disabled_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    orphan_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    oop_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    foreign_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    privileged_share: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)

    # ── Other ─────────────────────────────────────────────────────────────
    boarding_school_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    absences_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── Workflow ──────────────────────────────────────────────────────────
    submission_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )
