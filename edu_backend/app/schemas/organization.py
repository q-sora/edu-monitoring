"""
schemas/organization.py
─────────────────────────────────────────────────────────────────────────────
Pydantic V2 schemas for organizations, API tokens, reference data, and the
admin pending-submissions view.
"""
from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# Reference data (read-only response schemas)
# ─────────────────────────────────────────────────────────────────────────────

class OrgTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name_ru: str
    description: Optional[str] = None


class RegionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name_ru: str
    type: Optional[str] = None


class LocalityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    region_id: int
    name_ru: str
    type: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Organization
# ─────────────────────────────────────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    bin:               Optional[str]  = Field(None, max_length=12, min_length=12,
                                               description="БИН — ровно 12 цифр")
    name_ru:           str            = Field(..., min_length=3, max_length=500)
    org_type_id:       Optional[int]  = None
    org_kind_id:       Optional[int]  = None
    ownership_form_id: Optional[int]  = None
    region_id:         Optional[int]  = None
    locality_id:       Optional[int]  = None
    address_full:      Optional[str]  = Field(None, max_length=500)
    vuz_status:        Optional[str]  = Field(None, max_length=30)
    status:            str            = Field(default="active",
                                               pattern="^(active|reorganized|liquidated)$")

    @field_validator("bin")
    @classmethod
    def bin_digits_only(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.isdigit():
            raise ValueError("БИН должен содержать только цифры")
        return v


class OrganizationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name_ru:           Optional[str] = Field(None, min_length=3, max_length=500)
    org_kind_id:       Optional[int] = None
    ownership_form_id: Optional[int] = None
    region_id:         Optional[int] = None
    locality_id:       Optional[int] = None
    address_full:      Optional[str] = Field(None, max_length=500)
    vuz_status:        Optional[str] = Field(None, max_length=30)
    status:            Optional[str] = Field(None, pattern="^(active|reorganized|liquidated)$")


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                UUID
    bin:               Optional[str]
    name_ru:           str
    org_type_id:       Optional[int]
    org_kind_id:       Optional[int]
    ownership_form_id: Optional[int]
    region_id:         Optional[int]
    address_full:      Optional[str]
    status:            str
    vuz_status:        Optional[str]
    created_at:        datetime
    updated_at:        Optional[datetime]


class OrganizationListResponse(BaseModel):
    items: list[OrganizationResponse]
    total: int
    limit: int
    offset: int


# ─────────────────────────────────────────────────────────────────────────────
# API Tokens  (superadmin only)
# ─────────────────────────────────────────────────────────────────────────────

VALID_SCOPES = frozenset({"read", "write", "admin"})


class ApiTokenCreate(BaseModel):
    name:        str            = Field(..., min_length=1, max_length=200)
    org_id:      Optional[UUID] = None
    scopes:      list[str]      = Field(default=["read"])
    expires_days: Optional[int] = Field(None, ge=1, le=3650)

    @field_validator("scopes")
    @classmethod
    def scopes_must_be_valid(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_SCOPES
        if invalid:
            raise ValueError(f"Invalid scopes: {invalid}. Valid: {VALID_SCOPES}")
        return list(set(v))   # deduplicate


class ApiTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    name:         Optional[str]
    org_id:       Optional[UUID]
    scopes:       Optional[list[str]]
    is_active:    bool
    created_at:   datetime
    expires_at:   Optional[datetime]
    last_used_at: Optional[datetime]
    # Raw token returned ONLY on creation — never stored, never returned again
    raw_token:    Optional[str] = Field(None, exclude=False)


# ─────────────────────────────────────────────────────────────────────────────
# Admin: Pending submissions aggregated view
# ─────────────────────────────────────────────────────────────────────────────

class PendingSubmission(BaseModel):
    """
    One pending record across any domain table.
    Used by the admin /pending-submissions endpoint.
    """
    model_config = ConfigDict(from_attributes=True)

    record_id:    int
    table_name:   str
    table_label:  str      # Russian label for the UI
    org_id:       UUID
    org_name:     str
    period:       str      # human-readable period (e.g. "Апрель 2026" or "2025")
    status:       str
    submitted_at: Optional[datetime]
    submitted_by: Optional[str]


class PendingSubmissionsResponse(BaseModel):
    items: list[PendingSubmission]
    total: int


# ─────────────────────────────────────────────────────────────────────────────
# Audit log response
# ─────────────────────────────────────────────────────────────────────────────

class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         int
    table_name: str
    record_id:  str
    action:     str
    changed_by: Optional[str]
    org_id:     Optional[UUID]
    old_data:   Optional[dict[str, Any]]
    new_data:   Optional[dict[str, Any]]
    changed_at: datetime


class AuditLogResponse(BaseModel):
    items: list[AuditLogEntry]
    total: int
    limit: int
    offset: int
