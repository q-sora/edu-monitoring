"""
schemas/graduates.py
─────────────────────────────────────────────────────────────────────────────
Pydantic V2 schemas for graduates_records.
UNIQUE(org_id, graduation_year)
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ─── JSONB sub-schemas ───────────────────────────────────────────────────────

class EmployerPartnerItem(BaseModel):
    name:         str           = Field(..., min_length=1, max_length=300)
    industry:     Optional[str] = Field(None, max_length=100)
    hired_count:  Optional[int] = Field(None, ge=0)


class SalaryBySpecialty(BaseModel):
    """avg_salary_by_specialty_json: {"050103": {"name": "...", "avg_salary": 320000}}"""
    name:       Optional[str]     = None
    avg_salary: Optional[Decimal] = Field(None, ge=0)


# ─── Create ──────────────────────────────────────────────────────────────────

class GraduatesRecordCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    graduation_year: int = Field(..., ge=2000, le=2040)

    graduates_total:     Optional[int] = Field(None, ge=0)
    to_tippo_count:      Optional[int] = Field(None, ge=0)
    to_vipo_count:       Optional[int] = Field(None, ge=0)
    to_top_vipo_count:   Optional[int] = Field(None, ge=0)
    not_enrolled_count:  Optional[int] = Field(None, ge=0)

    final_attestation_avg_score: Optional[Decimal] = Field(None, ge=0, le=4.0)
    final_attestation_pass_pct:  Optional[Decimal] = Field(None, ge=0, le=100)

    employed_6m_pct:   Optional[Decimal] = Field(None, ge=0, le=100)
    employed_12m_pct:  Optional[Decimal] = Field(None, ge=0, le=100)
    employed_36m_pct:  Optional[Decimal] = Field(None, ge=0, le=100)
    employed_60m_pct:  Optional[Decimal] = Field(None, ge=0, le=100)

    # JSONB
    avg_salary_by_specialty_json:      Optional[dict[str, Any]] = None
    achievements_json:                 Optional[list[dict[str, Any]]] = None
    legal_entities_participation_json: Optional[dict[str, Any]] = None
    taxes_paid_json:                   Optional[dict[str, Any]] = None
    survey_results_json:               Optional[dict[str, Any]] = None
    employer_partners_json:            Optional[list[EmployerPartnerItem]] = None

    grant_workback_amount: Optional[Decimal] = Field(None, ge=0)

    submission_status: str = Field(default="draft", pattern="^(draft|submitted)$")

    @model_validator(mode="after")
    def validate_distribution(self) -> "GraduatesRecordCreate":
        total = self.graduates_total
        if total is not None and total > 0:
            dist = (
                (self.to_tippo_count or 0)
                + (self.to_vipo_count or 0)
                + (self.not_enrolled_count or 0)
            )
            if dist > total:
                raise ValueError(
                    f"Distribution total ({dist}) exceeds graduates_total ({total})"
                )
        return self

    def to_db_dict(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True)
        if self.employer_partners_json:
            data["employer_partners_json"] = [
                e.model_dump(exclude_none=True) for e in self.employer_partners_json
            ]
        return data


class GraduatesRecordUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    employed_6m_pct: Optional[Decimal] = Field(None, ge=0, le=100)
    employed_12m_pct: Optional[Decimal] = Field(None, ge=0, le=100)
    employed_36m_pct: Optional[Decimal] = Field(None, ge=0, le=100)
    employed_60m_pct: Optional[Decimal] = Field(None, ge=0, le=100)
    employer_partners_json: Optional[list[EmployerPartnerItem]] = None
    avg_salary_by_specialty_json: Optional[dict[str, Any]] = None
    grant_workback_amount: Optional[Decimal] = Field(None, ge=0)
    submission_status: Optional[str] = Field(None, pattern="^(draft|submitted)$")
    version: int = Field(..., ge=1)

    def to_db_dict(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True, exclude={"version"})
        if "employer_partners_json" in data and self.employer_partners_json:
            data["employer_partners_json"] = [
                e.model_dump(exclude_none=True) for e in self.employer_partners_json
            ]
        return data


class GraduatesRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: UUID
    graduation_year: int
    graduates_total: Optional[int] = None
    to_tippo_count: Optional[int] = None
    to_vipo_count: Optional[int] = None
    to_top_vipo_count: Optional[int] = None
    not_enrolled_count: Optional[int] = None
    final_attestation_avg_score: Optional[Decimal] = None
    final_attestation_pass_pct: Optional[Decimal] = None
    employed_6m_pct: Optional[Decimal] = None
    employed_12m_pct: Optional[Decimal] = None
    employed_36m_pct: Optional[Decimal] = None
    employed_60m_pct: Optional[Decimal] = None
    employer_partners_json: Optional[list[dict[str, Any]]] = None
    avg_salary_by_specialty_json: Optional[dict[str, Any]] = None
    grant_workback_amount: Optional[Decimal] = None
    submission_status: str
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class GraduatesListResponse(BaseModel):
    items: list[GraduatesRecordResponse]
    total: int
    limit: int
    offset: int
