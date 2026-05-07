"""
schemas/contingent.py
─────────────────────────────────────────────────────────────────────────────
Pydantic V2 schemas for contingent_snapshots.

Cross-field rules enforced here (mirrors Zod frontend validation):
    budget_count + paid_count   ≤ total_count
    all language counts sum     ≤ total_count  (soft warning, not hard error)
    privileged_share            ∈ [0, 100]
    all counts                  ≥ 0

Pydantic V2 compatibility note
──────────────────────────────
  The `decimal_places` constraint on `Optional[Decimal]` is not reliably
  propagated in Pydantic 2.7 (raises `Unknown constraint decimal_places`
  at model build time).  Precision for `privileged_share` is already
  enforced by the DB column type NUMERIC(5,2), so we drop it from the
  schema layer and keep only `ge` / `le` bounds.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
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

class PrizeWinnerItem(BaseModel):
    """Element in prize_winners_json."""
    event_type: str = Field(..., description="Олимпиада / конкурс / чемпионат")
    level: str = Field(..., description="regional / republican / international")
    count: int = Field(..., ge=0)


# ─────────────────────────────────────────────────────────────────────────────
# Create / Update
# ─────────────────────────────────────────────────────────────────────────────

class ContingentSnapshotCreate(BaseModel):
    """
    Body for POST /v1/organisations/{org_id}/contingent

    org_id is injected from JWT — never accepted from request body.
    Mirrors the React ContingentPage form fields exactly.
    """
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    # ── Unique key component ───────────────────────────────────────────────
    snapshot_date: date = Field(..., description="DATE — unique key with org_id")

    # ── Core counts ────────────────────────────────────────────────────────
    total_count:  Optional[int] = Field(None, ge=0, description="Общая численность")
    new_enrolled: Optional[int] = Field(None, ge=0, description="Вновь принятые")
    withdrawn:    Optional[int] = Field(None, ge=0, description="Отчислено")

    # ── By education level ─────────────────────────────────────────────────
    bachelor_count:  Optional[int] = Field(None, ge=0)
    master_count:    Optional[int] = Field(None, ge=0)
    phd_count:       Optional[int] = Field(None, ge=0)
    full_time_count: Optional[int] = Field(None, ge=0)
    distance_count:  Optional[int] = Field(None, ge=0)
    budget_count:    Optional[int] = Field(None, ge=0, description="Государственный грант")
    paid_count:      Optional[int] = Field(None, ge=0, description="Платная основа")

    # ── JSONB breakdowns ───────────────────────────────────────────────────
    by_grade_json:     Optional[dict[str, int]] = Field(
        None, description='JSONB: {"1": 120, "2": 115, ...}'
    )
    by_specialty_json: Optional[dict[str, int]] = Field(
        None, description='JSONB: {"050103": 45, ...}'
    )
    prize_winners_json: Optional[list[PrizeWinnerItem]] = None

    # ── By language ────────────────────────────────────────────────────────
    kz_lang_count:    Optional[int] = Field(None, ge=0)
    ru_lang_count:    Optional[int] = Field(None, ge=0)
    en_lang_count:    Optional[int] = Field(None, ge=0)
    other_lang_count: Optional[int] = Field(None, ge=0)

    # ── Privileged categories ──────────────────────────────────────────────
    many_children_count: Optional[int] = Field(None, ge=0)
    low_income_count:    Optional[int] = Field(None, ge=0)
    disabled_count:      Optional[int] = Field(None, ge=0)
    orphan_count:        Optional[int] = Field(None, ge=0)
    oop_count:           Optional[int] = Field(None, ge=0)
    foreign_count:       Optional[int] = Field(None, ge=0)

    # ── Derived / other ────────────────────────────────────────────────────
    # Precision enforced by DB column type NUMERIC(5,2) — we don't need
    # decimal_places at the Pydantic layer (it raises in Pydantic 2.7).
    privileged_share:      Optional[Decimal] = Field(None, ge=0, le=100)
    boarding_school_count: Optional[int]     = Field(None, ge=0)
    absences_count:        Optional[int]     = Field(None, ge=0)

    # ── Workflow ──────────────────────────────────────────────────────────
    submission_status: str = Field(
        default="draft",
        pattern="^(draft|submitted)$",
    )

    # ── Cross-field validation ─────────────────────────────────────────────
    @model_validator(mode="after")
    def validate_counts(self) -> "ContingentSnapshotCreate":
        total = self.total_count

        # Hard rule: budget + paid ≤ total
        if total is not None:
            b = self.budget_count or 0
            p = self.paid_count or 0
            if b + p > total:
                raise ValueError(
                    f"budget_count ({b}) + paid_count ({p}) = {b+p} "
                    f"exceeds total_count ({total})"
                )

        # Soft rule: language sum should not exceed total (allow ±5 rounding)
        if total is not None and total > 0:
            lang_sum = sum(
                v or 0 for v in [
                    self.kz_lang_count, self.ru_lang_count,
                    self.en_lang_count, self.other_lang_count,
                ]
            )
            if lang_sum > total + 5:
                raise ValueError(
                    f"Sum of language counts ({lang_sum}) exceeds "
                    f"total_count ({total}). Check your language breakdown."
                )

        return self

    def to_db_dict(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True)
        # Serialise JSONB sub-model list
        if self.prize_winners_json:
            data["prize_winners_json"] = [
                p.model_dump() for p in self.prize_winners_json
            ]
        return data


class ContingentSnapshotUpdate(BaseModel):
    """Partial update — all fields optional; version required for optimistic lock."""
    model_config = ConfigDict(str_strip_whitespace=True)

    total_count: Optional[int] = Field(None, ge=0)
    new_enrolled: Optional[int] = Field(None, ge=0)
    withdrawn: Optional[int] = Field(None, ge=0)
    bachelor_count: Optional[int] = Field(None, ge=0)
    master_count: Optional[int] = Field(None, ge=0)
    phd_count: Optional[int] = Field(None, ge=0)
    full_time_count: Optional[int] = Field(None, ge=0)
    distance_count: Optional[int] = Field(None, ge=0)
    budget_count: Optional[int] = Field(None, ge=0)
    paid_count: Optional[int] = Field(None, ge=0)
    by_grade_json: Optional[dict[str, int]] = None
    by_specialty_json: Optional[dict[str, int]] = None
    prize_winners_json: Optional[list[PrizeWinnerItem]] = None
    kz_lang_count: Optional[int] = Field(None, ge=0)
    ru_lang_count: Optional[int] = Field(None, ge=0)
    en_lang_count: Optional[int] = Field(None, ge=0)
    other_lang_count: Optional[int] = Field(None, ge=0)
    many_children_count: Optional[int] = Field(None, ge=0)
    low_income_count: Optional[int] = Field(None, ge=0)
    disabled_count: Optional[int] = Field(None, ge=0)
    orphan_count: Optional[int] = Field(None, ge=0)
    oop_count: Optional[int] = Field(None, ge=0)
    foreign_count: Optional[int] = Field(None, ge=0)
    privileged_share: Optional[Decimal] = Field(None, ge=0, le=100)
    boarding_school_count: Optional[int] = Field(None, ge=0)
    absences_count: Optional[int] = Field(None, ge=0)
    submission_status: Optional[str] = Field(None, pattern="^(draft|submitted)$")

    version: int = Field(..., ge=1, description="Optimistic lock — must match current")

    def to_db_dict(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True, exclude={"version"})
        if "prize_winners_json" in data and self.prize_winners_json:
            data["prize_winners_json"] = [p.model_dump() for p in self.prize_winners_json]
        return data


# ─────────────────────────────────────────────────────────────────────────────
# Response
# ─────────────────────────────────────────────────────────────────────────────

class ContingentSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: UUID
    snapshot_date: date
    total_count: Optional[int] = None
    new_enrolled: Optional[int] = None
    withdrawn: Optional[int] = None
    bachelor_count: Optional[int] = None
    master_count: Optional[int] = None
    phd_count: Optional[int] = None
    full_time_count: Optional[int] = None
    distance_count: Optional[int] = None
    budget_count: Optional[int] = None
    paid_count: Optional[int] = None
    by_grade_json: Optional[dict[str, Any]] = None
    by_specialty_json: Optional[dict[str, Any]] = None
    prize_winners_json: Optional[list[dict[str, Any]]] = None
    kz_lang_count: Optional[int] = None
    ru_lang_count: Optional[int] = None
    en_lang_count: Optional[int] = None
    other_lang_count: Optional[int] = None
    many_children_count: Optional[int] = None
    low_income_count: Optional[int] = None
    disabled_count: Optional[int] = None
    orphan_count: Optional[int] = None
    oop_count: Optional[int] = None
    foreign_count: Optional[int] = None
    privileged_share: Optional[Decimal] = None
    boarding_school_count: Optional[int] = None
    absences_count: Optional[int] = None
    submission_status: str
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class ContingentListResponse(BaseModel):
    items: list[ContingentSnapshotResponse]
    total: int
    limit: int
    offset: int
