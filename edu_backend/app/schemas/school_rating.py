"""
schemas/school_rating.py — Pydantic models for school rating.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SchoolRatingCreate(BaseModel):
    """Request body for creating/updating a school rating submission."""
    model_config = ConfigDict(populate_by_name=True)

    academic_year: int = Field(..., ge=2020, le=2030)
    submission_status: str = Field(default="draft", pattern="^(draft|submitted)$")
    raw_data: dict[str, Any] = Field(default_factory=dict)


class SchoolRatingUpdate(BaseModel):
    """Request body for updating a school rating submission."""
    submission_status: Optional[str] = Field(None, pattern="^(draft|submitted)$")
    raw_data: Optional[dict[str, Any]] = None
    version: int = Field(..., ge=1)


class SchoolRatingResponse(BaseModel):
    """Response model for a school rating submission."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: UUID
    submitted_by: Optional[UUID]
    academic_year: int
    submission_status: str
    raw_data: dict[str, Any]
    scores: dict[str, Any]
    version: int
    created_at: datetime
    updated_at: Optional[datetime]


class SchoolRatingListResponse(BaseModel):
    """Paginated list of school rating submissions."""
    items: list[SchoolRatingResponse]
    total: int
    limit: int
    offset: int
