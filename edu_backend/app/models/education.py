"""
models/education.py — educational_process ORM model
"""
from __future__ import annotations

from datetime import date
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, Date, ForeignKey, Index, Integer, String, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import FullAuditMixin


class EducationalProcess(FullAuditMixin, Base):
    """UNIQUE(org_id, snapshot_date)"""
    __tablename__ = "educational_process"
    __table_args__ = (
        UniqueConstraint("org_id", "snapshot_date", name="uq_education_org_date"),
        Index("ix_education_active", "org_id", "snapshot_date",
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

    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)

    mandatory_programs_count:     Mapped[Optional[int]]  = mapped_column(Integer)
    optional_programs_count:      Mapped[Optional[int]]  = mapped_column(Integer)
    international_programs_count: Mapped[Optional[int]]  = mapped_column(Integer)
    has_developing_environment:   Mapped[Optional[bool]] = mapped_column(Boolean)
    startup_projects_count:       Mapped[Optional[int]]  = mapped_column(Integer)

    additional_programs_json:    Mapped[Optional[list[dict[str, Any]]]] = mapped_column(JSONB)
    circles_sections_json:       Mapped[Optional[list[dict[str, Any]]]] = mapped_column(JSONB)
    olympiad_participation_json: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(JSONB)
    parent_survey_results_json:  Mapped[Optional[dict[str, Any]]]       = mapped_column(JSONB)
    academic_mobility_json:      Mapped[Optional[dict[str, Any]]]       = mapped_column(JSONB)
    academic_performance_json:   Mapped[Optional[dict[str, Any]]]       = mapped_column(JSONB)
    practice_partners_json:      Mapped[Optional[list[dict[str, Any]]]] = mapped_column(JSONB)

    submission_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )
