"""schemas/coefficients.py — Pydantic-схемы для системы коэффициентов."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CoefficientDefinitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    education_level: str
    principle: str
    number: int
    name_ru: str
    formula_text: str
    formula_type: str
    numerator_desc: Optional[str] = None
    denominator_desc: Optional[str] = None
    norm_min: Optional[Decimal] = None
    norm_max: Optional[Decimal] = None
    norm_target: Optional[Decimal] = None
    numerator_catalog_id: Optional[int] = None
    denominator_catalog_id: Optional[int] = None
    is_active: bool = True


class CoefficientRecordCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    org_id: UUID
    coeff_def_id: int
    period_year: int = Field(..., ge=2015, le=2035)
    period_quarter: Optional[int] = Field(None, ge=1, le=4)
    numerator_value: Optional[Decimal] = Field(None, ge=0)
    denominator_value: Optional[Decimal] = Field(None, ge=0)
    comment: Optional[str] = None


class CoefficientRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: UUID
    coeff_def_id: int
    period_year: int
    period_quarter: Optional[int] = None
    numerator_value: Optional[Decimal] = None
    denominator_value: Optional[Decimal] = None
    coefficient_value: Optional[Decimal] = None
    status: str
    submission_status: str
    comment: Optional[str] = None
    definition: Optional[CoefficientDefinitionRead] = None


class CoefficientScoreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: UUID
    education_level: str
    period_year: int
    score_transparency: Optional[Decimal] = None
    score_self_development: Optional[Decimal] = None
    score_financial_stability: Optional[Decimal] = None
    score_safety: Optional[Decimal] = None
    score_investment_appeal: Optional[Decimal] = None
    total_score: Optional[Decimal] = None
    rating_category: Optional[str] = None


class OrgRatingEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_id: UUID
    org_name: str
    region_id: Optional[int] = None
    region_name_ru: Optional[str] = None
    education_level: str
    period_year: int
    total_score: Optional[Decimal] = None
    rating_category: Optional[str] = None
    score_transparency: Optional[Decimal] = None
    score_self_development: Optional[Decimal] = None
    score_financial_stability: Optional[Decimal] = None
    score_safety: Optional[Decimal] = None
    score_investment_appeal: Optional[Decimal] = None
    prev_total_score: Optional[Decimal] = None
