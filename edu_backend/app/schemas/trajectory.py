"""
schemas/trajectory.py — Pydantic V2 схемы для траектории учащегося
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# StudentAcademic — GPA по семестру
# ─────────────────────────────────────────────────────────────────────────────

class StudentAcademicCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    academic_year:   int            = Field(..., ge=2000, le=2035)
    semester_number: int            = Field(..., ge=1, le=12)
    gpa:             Optional[Decimal] = Field(None, ge=Decimal("2.00"), le=Decimal("5.00"))
    credits_earned:  Optional[int]  = Field(None, ge=0)
    source_id:       Optional[int]  = None


class StudentAcademicRead(StudentAcademicCreate):
    id:         int
    iin:        str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="ignore")


# ─────────────────────────────────────────────────────────────────────────────
# StudentEmployment — занятость (МТСЗН)
# ─────────────────────────────────────────────────────────────────────────────

class StudentEmploymentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period_year:       int  = Field(..., ge=2000, le=2035)
    employment_status: Literal["employed", "unemployed", "ip", "unknown"] = "unknown"
    employment_date:   Optional[date] = None
    employer_name:     Optional[str]  = Field(None, max_length=500)
    employer_bin:      Optional[str]  = Field(None, max_length=12)
    employer_oked:     Optional[str]  = Field(None, max_length=10)
    region_id:         Optional[int]  = None
    specialty_match:   Optional[bool] = None
    months_to_employ:  Optional[int]  = Field(None, ge=0, le=120)
    source_id:         Optional[int]  = None


class StudentEmploymentRead(StudentEmploymentCreate):
    id:         int
    iin:        str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="ignore")


# ─────────────────────────────────────────────────────────────────────────────
# StudentSalary — зарплата (КГД / ГЦВП)
# ─────────────────────────────────────────────────────────────────────────────

class StudentSalaryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period_year:    int     = Field(..., ge=2000, le=2035)
    period_quarter: int     = Field(..., ge=1, le=4)
    salary_amount:  Optional[Decimal] = Field(None, ge=0)
    ipn_amount:     Optional[Decimal] = Field(None, ge=0)
    pension_amount: Optional[Decimal] = Field(None, ge=0)
    income_source:  Literal["hire", "entrepreneurship", "other"] = "hire"
    employer_oked:  Optional[str] = Field(None, max_length=10)
    source_type:    Literal["kgd", "gcvp"] = "kgd"
    source_id:      Optional[int] = None


class StudentSalaryRead(StudentSalaryCreate):
    id:         int
    iin:        str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="ignore")


# ─────────────────────────────────────────────────────────────────────────────
# StudentRegistry — основная запись студента (НЦТ)
# ─────────────────────────────────────────────────────────────────────────────

class StudentRegistryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    iin:             str = Field(..., min_length=12, max_length=12, pattern=r"^\d{12}$")
    education_level: Literal["tippo", "bachelor", "master", "phd"]
    specialty_code:  Optional[str]     = Field(None, max_length=50)
    specialty_name:  Optional[str]     = None
    graduation_year: int               = Field(..., ge=2000, le=2035)
    enrollment_year: Optional[int]     = Field(None, ge=2000, le=2035)
    ent_score:       Optional[int]     = Field(None, ge=0, le=140)
    is_grant:        Optional[bool]    = None
    tuition_cost_annual: Optional[Decimal] = Field(None, ge=0)
    total_budget_spent:  Optional[Decimal] = Field(None, ge=0)
    source_id:       Optional[int]     = None


class StudentRegistryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    education_level: Optional[Literal["tippo", "bachelor", "master", "phd"]] = None
    specialty_code:  Optional[str]     = Field(None, max_length=50)
    specialty_name:  Optional[str]     = None
    graduation_year: Optional[int]     = Field(None, ge=2000, le=2035)
    enrollment_year: Optional[int]     = Field(None, ge=2000, le=2035)
    ent_score:       Optional[int]     = Field(None, ge=0, le=140)
    is_grant:        Optional[bool]    = None
    tuition_cost_annual: Optional[Decimal] = Field(None, ge=0)
    total_budget_spent:  Optional[Decimal] = Field(None, ge=0)
    source_id:       Optional[int]     = None


class StudentRegistryRead(BaseModel):
    id:              int
    iin:             str
    org_id:          UUID
    education_level: str
    specialty_code:  Optional[str]
    specialty_name:  Optional[str]
    graduation_year: int
    enrollment_year: Optional[int]
    ent_score:       Optional[int]
    is_grant:        Optional[bool]
    tuition_cost_annual: Optional[Decimal]
    total_budget_spent:  Optional[Decimal]
    source_id:       Optional[int]
    version:         int
    created_at:      datetime
    updated_at:      Optional[datetime]

    # вложенные данные (опционально, при детальном запросе)
    academic:    list[StudentAcademicRead]   = []
    employment:  list[StudentEmploymentRead] = []
    salary:      list[StudentSalaryRead]     = []

    model_config = ConfigDict(from_attributes=True, extra="ignore")


class StudentRegistryListResponse(BaseModel):
    items:  list[StudentRegistryRead]
    total:  int
    limit:  int
    offset: int


class StudentBulkCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    students: list[StudentRegistryCreate] = Field(..., min_length=1, max_length=5000)


class StudentBulkResult(BaseModel):
    created:  int
    skipped:  int
    errors:   list[str] = []


# ─────────────────────────────────────────────────────────────────────────────
# Analytics — воронка, scatter, паттерны
# ─────────────────────────────────────────────────────────────────────────────

class FunnelStep(BaseModel):
    label: str
    n:     int
    pct:   float
    note:  str = ""


class TrajectoryFunnelResponse(BaseModel):
    org_id:          UUID
    graduation_year: int
    total:           int
    funnel:          list[FunnelStep]


class ScatterPoint(BaseModel):
    iin_masked:  str            # последние 4 цифры: ****XXXXXXXX
    ent_score:   Optional[int]
    gpa_year1:   Optional[float]
    gpa_final:   Optional[float]
    trajectory:  str            # stable / faller / riser / changed


class TrajectoryScatterResponse(BaseModel):
    org_id:          UUID
    graduation_year: int
    points:          list[ScatterPoint]


class PatternCard(BaseModel):
    count:       int
    label:       str
    description: str


class SalaryPremium(BaseModel):
    good_gpa_avg_tks: Optional[float]
    weak_gpa_avg_tks: Optional[float]
    difference_tks:   Optional[float]


class TrajectoryPatternsResponse(BaseModel):
    org_id:          UUID
    graduation_year: int
    total:           int
    fallers:         PatternCard
    risers:          PatternCard
    dropouts:        PatternCard
    salary_premium:  SalaryPremium


# ─────────────────────────────────────────────────────────────────────────────
# Table row — агрегированные данные по студенту для таблицы (top-15)
# ─────────────────────────────────────────────────────────────────────────────

class StudentTableRow(BaseModel):
    iin_masked:       str
    ent_score:        Optional[int]
    gpa_year1:        Optional[float]
    gpa_final:        Optional[float]
    trajectory:       str            # stable / faller / riser / changed
    group_label:      str            # Отличник / Хорошист / Троечник
    employed:         bool
    specialty_match:  Optional[bool]
    avg_salary_tks:   Optional[float]  # тыс. тенге


class TrajectoryTableResponse(BaseModel):
    org_id:          UUID
    graduation_year: int
    total:           int
    rows:            list[StudentTableRow]
