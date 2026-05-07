"""
schemas/science.py
─────────────────────────────────────────────────────────────────────────────
Pydantic V2 request / response schemas for science_activity.

Design rules
────────────
  • Field names match SQL column names exactly (no aliasing) so that
    dict(schema_instance) maps directly to INSERT/UPDATE parameters.
  • All JSONB sub-schemas are defined as nested Pydantic models, then
    serialised to list[dict] via model.model_dump() before the DB call.
    asyncpg accepts plain Python dicts for JSONB — no json.dumps() needed.
  • Monetary / ratio fields use Decimal for precision, not float.
  • org_id is NEVER accepted from the request body (always injected from JWT).
  • submission_status follows the state machine defined in dependencies.py.

Pydantic V2 compatibility notes
───────────────────────────────
  1. Class-level constants inside a BaseModel subclass MUST be annotated with
     `typing.ClassVar[...]`.  Otherwise Pydantic treats them as required model
     fields and raises PydanticUserError at import time.

  2. The `decimal_places` constraint on `Optional[Decimal]` is NOT reliably
     propagated in Pydantic 2.7 — it raises `ValueError: Unknown constraint
     decimal_places` at model build time.  Precision is already enforced by
     the PostgreSQL column type (NUMERIC(6,2)), so we don't need it at the
     schema layer.  We keep `ge=` bounds but drop `decimal_places=`.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, ClassVar, Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

# ─────────────────────────────────────────────────────────────────────────────
# JSONB sub-schemas
# ─────────────────────────────────────────────────────────────────────────────

class GrantItem(BaseModel):
    """Single element in grants_json array — stored as JSONB."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=3, max_length=500, description="Название гранта")
    amount: Optional[Decimal] = Field(
        None, ge=0, description="Сумма финансирования в тенге"
    )
    direction: Optional[str] = Field(None, max_length=200, description="Направление / сфера")
    duration_years: Optional[int] = Field(
        None, ge=1, le=20, description="Срок реализации (лет)"
    )

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Название гранта не может быть пустым")
        return v.strip()


class StudentProjectItem(BaseModel):
    """Single element in student_projects_json array."""

    model_config = ConfigDict(str_strip_whitespace=True)

    # ClassVar tells Pydantic V2 this is a class-level constant, NOT a model
    # field.  Without this annotation Pydantic raises PydanticUserError.
    VALID_STAGES: ClassVar[frozenset[str]] = frozenset(
        {"концепция", "разработка", "MVP", "коммерциализация", "завершён"}
    )

    title: str = Field(..., min_length=1, max_length=300)
    stage: str = Field(..., description="Стадия проекта")
    funding: Optional[Decimal] = Field(None, ge=0, description="Финансирование (₸)")

    @field_validator("stage")
    @classmethod
    def stage_must_be_valid(cls, v: str) -> str:
        if v not in StudentProjectItem.VALID_STAGES:
            raise ValueError(
                f"Недопустимая стадия: {v!r}. "
                f"Допустимые: {sorted(StudentProjectItem.VALID_STAGES)}"
            )
        return v


# ─────────────────────────────────────────────────────────────────────────────
# Request schemas
# ─────────────────────────────────────────────────────────────────────────────

class ScienceActivityCreate(BaseModel):
    """
    Body for POST /v1/organisations/{org_id}/science-activity

    org_id is injected from the JWT token — NEVER from this schema.
    Mirrors the Zod `scienceSchema` from the frontend exactly.
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        # Accept both snake_case and camelCase from the React form
        populate_by_name=True,
    )

    # ── Period (unique key component) ──────────────────────────────────────
    period_year: int = Field(
        ...,
        ge=2010,
        le=2035,
        description="Отчётный год — SMALLINT; forms unique key with org_id",
    )

    # ── JSONB arrays ───────────────────────────────────────────────────────
    grants_json: Optional[list[GrantItem]] = Field(
        None,
        description="Научные гранты — хранятся как JSONB[]",
    )
    student_projects_json: Optional[list[StudentProjectItem]] = Field(
        None,
        description="Студенческие проекты/стартапы — JSONB[]",
    )

    # ── Scalar fields (exact column names) ────────────────────────────────
    # Precision (decimal_places) is enforced by DB column type NUMERIC(6,2).
    # We do not duplicate this constraint at the Pydantic layer.
    hirsch_index_avg: Optional[Decimal] = Field(
        None, ge=0, description="NUMERIC(6,2)"
    )
    hirsch_index_max: Optional[Decimal] = Field(None, ge=0)
    publications_q1: Optional[int] = Field(None, ge=0)
    publications_q2: Optional[int] = Field(None, ge=0)
    publications_q3: Optional[int] = Field(None, ge=0)
    publications_q4: Optional[int] = Field(None, ge=0)
    publications_scopus: Optional[int] = Field(None, ge=0)
    publications_wos: Optional[int] = Field(None, ge=0)

    # ── Workflow ──────────────────────────────────────────────────────────
    submission_status: str = Field(
        default="draft",
        pattern="^(draft|submitted)$",
        description="Only draft and submitted are valid on create",
    )

    # ── Cross-field validation ─────────────────────────────────────────────
    @model_validator(mode="after")
    def grants_must_have_titles(self) -> ScienceActivityCreate:
        """Filter out grant objects that have no title (React form sends empties)."""
        if self.grants_json:
            self.grants_json = [g for g in self.grants_json if g.title.strip()]
        if self.student_projects_json:
            self.student_projects_json = [
                p for p in self.student_projects_json if p.title.strip()
            ]
        return self

    def to_db_dict(self) -> dict[str, Any]:
        """
        Serialise to a plain dict ready for SQLAlchemy INSERT.
        JSONB fields are converted to list[dict] — asyncpg accepts this directly.
        Decimal fields are left as Decimal (asyncpg handles them correctly).
        org_id is NOT included here — the CRUD layer injects it from the JWT.
        """
        data = self.model_dump(exclude_none=True)

        # Convert Pydantic sub-models to plain dicts for JSONB columns
        if self.grants_json:
            data["grants_json"] = [g.model_dump(exclude_none=True) for g in self.grants_json]
        if self.student_projects_json:
            data["student_projects_json"] = [
                p.model_dump(exclude_none=True) for p in self.student_projects_json
            ]

        return data


class ScienceActivityUpdate(BaseModel):
    """
    Body for PATCH /v1/organisations/{org_id}/science-activity/{id}

    All fields optional.  Only draft-status records can be updated.
    Includes `version` for optimistic locking — must match current DB value.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    grants_json: Optional[list[GrantItem]] = None
    student_projects_json: Optional[list[StudentProjectItem]] = None
    hirsch_index_avg: Optional[Decimal] = Field(None, ge=0)
    hirsch_index_max: Optional[Decimal] = Field(None, ge=0)
    publications_q1: Optional[int] = Field(None, ge=0)
    publications_q2: Optional[int] = Field(None, ge=0)
    publications_q3: Optional[int] = Field(None, ge=0)
    publications_q4: Optional[int] = Field(None, ge=0)
    publications_scopus: Optional[int] = Field(None, ge=0)
    publications_wos: Optional[int] = Field(None, ge=0)
    submission_status: Optional[str] = Field(
        None, pattern="^(draft|submitted)$"
    )

    # Optimistic lock version — REQUIRED on update to detect concurrent edits
    version: int = Field(..., ge=1, description="Current record version from the last GET")

    def to_db_dict(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True, exclude={"version"})
        if "grants_json" in data and self.grants_json:
            data["grants_json"] = [g.model_dump(exclude_none=True) for g in self.grants_json]
        if "student_projects_json" in data and self.student_projects_json:
            data["student_projects_json"] = [
                p.model_dump(exclude_none=True) for p in self.student_projects_json
            ]
        return data


class StatusChangeRequest(BaseModel):
    """Body for PATCH /…/status — admin approve / reject."""

    new_status: str = Field(
        ...,
        pattern="^(under_review|approved|rejected|draft)$",
    )
    comment: Optional[str] = Field(None, max_length=1000)


# ─────────────────────────────────────────────────────────────────────────────
# Response schemas
# ─────────────────────────────────────────────────────────────────────────────

class ScienceActivityResponse(BaseModel):
    """
    Full record returned from GET and after successful POST/PATCH.
    Includes audit fields from FullAuditMixin.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: UUID
    period_year: int
    grants_json: Optional[list[dict[str, Any]]] = None
    student_projects_json: Optional[list[dict[str, Any]]] = None
    hirsch_index_avg: Optional[Decimal] = None
    hirsch_index_max: Optional[Decimal] = None
    publications_q1: Optional[int] = None
    publications_q2: Optional[int] = None
    publications_q3: Optional[int] = None
    publications_q4: Optional[int] = None
    publications_scopus: Optional[int] = None
    publications_wos: Optional[int] = None
    submission_status: str
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class ScienceActivityListResponse(BaseModel):
    """Paginated list wrapper."""

    items: list[ScienceActivityResponse]
    total: int
    limit: int
    offset: int


class ScienceActivitySummary(BaseModel):
    """Lightweight projection for list views / dashboard widgets."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    period_year: int
    # In Pydantic v2 `Optional[int]` without a default makes the field required.
    # We want these Optional with default = None so from_attributes works with
    # partial ORM rows.
    publications_scopus: Optional[int] = None
    publications_wos: Optional[int] = None
    grants_count: int = Field(default=0, description="Derived: len(grants_json)")
    submission_status: str
    updated_at: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def compute_derived(cls, values: Any) -> Any:
        if hasattr(values, "grants_json") and values.grants_json:
            values.__dict__["grants_count"] = len(values.grants_json)
        return values
