"""
models/graduates.py — graduates_records ORM model
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    ForeignKey, Index, Integer, Numeric, SmallInteger, String, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import FullAuditMixin


class GraduatesRecord(FullAuditMixin, Base):
    """UNIQUE(org_id, graduation_year)"""
    __tablename__ = "graduates_records"
    __table_args__ = (
        UniqueConstraint("org_id", "graduation_year", name="uq_graduates_org_year"),
        Index("ix_graduates_active", "org_id", "graduation_year",
              postgresql_where=text("deleted_at IS NULL")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True
    )

    graduation_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    graduates_total:    Mapped[Optional[int]] = mapped_column(Integer)
    to_tippo_count:     Mapped[Optional[int]] = mapped_column(Integer)
    to_vipo_count:      Mapped[Optional[int]] = mapped_column(Integer)
    to_top_vipo_count:  Mapped[Optional[int]] = mapped_column(Integer)
    not_enrolled_count: Mapped[Optional[int]] = mapped_column(Integer)

    final_attestation_avg_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    final_attestation_pass_pct:  Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))

    employed_6m_pct:  Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    employed_12m_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    employed_36m_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    employed_60m_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))

    avg_salary_by_specialty_json:      Mapped[Optional[dict[str, Any]]]  = mapped_column(JSONB)
    achievements_json:                 Mapped[Optional[list[dict[str, Any]]]] = mapped_column(JSONB)
    legal_entities_participation_json: Mapped[Optional[dict[str, Any]]]  = mapped_column(JSONB)
    taxes_paid_json:                   Mapped[Optional[dict[str, Any]]]  = mapped_column(JSONB)
    survey_results_json:               Mapped[Optional[dict[str, Any]]]  = mapped_column(JSONB)
    employer_partners_json:            Mapped[Optional[list[dict[str, Any]]]] = mapped_column(JSONB)

    grant_workback_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))

    submission_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )
