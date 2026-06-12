"""
schemas/education.py — educational_process
UNIQUE(org_id, snapshot_date)

Pydantic V2 compatibility note
──────────────────────────────
  Any class-level constant inside a BaseModel subclass MUST be annotated with
  `typing.ClassVar[...]` — otherwise Pydantic treats it as a required model
  field and raises PydanticUserError at import time.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, ClassVar, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PracticePartnerItem(BaseModel):
    name:         str           = Field(..., min_length=1)
    industry:     Optional[str] = None
    places_count: Optional[int] = Field(None, ge=0)


class OlympiadItem(BaseModel):
    # ClassVar tells Pydantic V2 this is a class-level constant, NOT a model
    # field.  Without this annotation Pydantic raises PydanticUserError.
    VALID_LEVELS: ClassVar[frozenset[str]] = frozenset(
        {"regional", "republican", "international"}
    )

    event_name:    str           = Field(..., min_length=1)
    level:         str           = Field(..., description="regional/republican/international")
    prizes_gold:   Optional[int] = Field(None, ge=0)
    prizes_silver: Optional[int] = Field(None, ge=0)

    @field_validator("level")
    @classmethod
    def level_must_be_valid(cls, v: str) -> str:
        if v not in OlympiadItem.VALID_LEVELS:
            raise ValueError(
                f"Недопустимый уровень: {v!r}. "
                f"Допустимые: {sorted(OlympiadItem.VALID_LEVELS)}"
            )
        return v


class EducationalProcessCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    snapshot_date: date = Field(..., description="DATE — unique key with org_id")

    mandatory_programs_count:     Optional[int]  = Field(None, ge=0)
    optional_programs_count:      Optional[int]  = Field(None, ge=0)
    international_programs_count: Optional[int]  = Field(None, ge=0)
    has_developing_environment:   Optional[bool] = None
    startup_projects_count:       Optional[int]  = Field(None, ge=0)

    # JSONB
    additional_programs_json:    Optional[list[dict[str, Any]]] = None
    circles_sections_json:       Optional[list[dict[str, Any]]] = None
    olympiad_participation_json: Optional[list[OlympiadItem]]   = None
    parent_survey_results_json:  Optional[dict[str, Any]]       = None
    academic_mobility_json:      Optional[dict[str, Any]]       = Field(
        None,
        description='{"incoming_count": 0, "outgoing_count": 0}',
    )
    academic_performance_json:   Optional[dict[str, Any]]       = Field(
        None,
        description='{"avg_gpa": 3.5, "pass_rate_pct": 94.2}',
    )
    practice_partners_json:      Optional[list[PracticePartnerItem]] = None

    submission_status: str = Field(default="draft", pattern="^(draft|submitted)$")

    def to_db_dict(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True)
        if self.olympiad_participation_json:
            data["olympiad_participation_json"] = [
                o.model_dump(exclude_none=True) for o in self.olympiad_participation_json
            ]
        if self.practice_partners_json:
            data["practice_partners_json"] = [
                p.model_dump(exclude_none=True) for p in self.practice_partners_json
            ]
        return data


class EducationalProcessUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    mandatory_programs_count:     Optional[int]  = Field(None, ge=0)
    optional_programs_count:      Optional[int]  = Field(None, ge=0)
    international_programs_count: Optional[int]  = Field(None, ge=0)
    has_developing_environment:   Optional[bool] = None
    startup_projects_count:       Optional[int]  = Field(None, ge=0)
    academic_mobility_json:       Optional[dict[str, Any]]            = None
    academic_performance_json:    Optional[dict[str, Any]]            = None
    practice_partners_json:       Optional[list[PracticePartnerItem]] = None
    olympiad_participation_json:  Optional[list[OlympiadItem]]        = None
    submission_status:            Optional[str]  = Field(None, pattern="^(draft|submitted)$")
    version: int = Field(..., ge=1)

    def to_db_dict(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True, exclude={"version"})
        if "practice_partners_json" in data and self.practice_partners_json:
            data["practice_partners_json"] = [
                p.model_dump(exclude_none=True) for p in self.practice_partners_json
            ]
        if "olympiad_participation_json" in data and self.olympiad_participation_json:
            data["olympiad_participation_json"] = [
                o.model_dump(exclude_none=True) for o in self.olympiad_participation_json
            ]
        return data


class EducationalProcessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: UUID
    snapshot_date: date
    mandatory_programs_count:     Optional[int]  = None
    optional_programs_count:      Optional[int]  = None
    international_programs_count: Optional[int]  = None
    has_developing_environment:   Optional[bool] = None
    startup_projects_count:       Optional[int]  = None
    academic_mobility_json:       Optional[dict[str, Any]]       = None
    academic_performance_json:    Optional[dict[str, Any]]       = None
    practice_partners_json:       Optional[list[dict[str, Any]]] = None
    olympiad_participation_json:  Optional[list[dict[str, Any]]] = None
    submission_status: str
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class EducationListResponse(BaseModel):
    items: list[EducationalProcessResponse]
    total: int
    limit: int
    offset: int
