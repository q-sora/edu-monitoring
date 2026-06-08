"""
models/school_rating.py — School rating submissions and scores.
"""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    ForeignKey, Integer, String, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import FullAuditMixin


class SchoolRatingSubmission(FullAuditMixin, Base):
    """
    Stores school rating data (raw_data) and calculated results (scores).
    Optimistic locking via 'version' (from AuditMixin).
    Audit trail via event listeners.
    """
    __tablename__ = "school_rating_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    school_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, 
        index=True,
    )
    
    submitted_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    academic_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    
    # submission_status: draft, submitted, under_review, approved, rejected
    submission_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft", index=True
    )

    # Raw input from the user/form
    raw_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    
    # Calculated scores and breakdown
    scores: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
