"""
schemas/presentation.py
─────────────────────────────────────────────────────────────────────────────
Pydantic V2 schemas for the AI Presentation Reports module.

Supports both legacy 5-slide format and new agentic 8-12 slide format.
All extra fields from Gemini are silently ignored (extra="ignore") so the
schema remains forward-compatible with new slide types.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class SlideType(str, Enum):
    # ── Legacy types (backward compat with existing reports) ─────────────────
    TITLE_SLIDE         = "title_slide"
    METRICS_COMPARISON  = "metrics_comparison"
    ANOMALIES_WARNING   = "anomalies_warning"
    RATING_BOARD        = "rating_board"
    AI_RECOMMENDATIONS  = "ai_recommendations"
    # ── Agentic orchestrator types ────────────────────────────────────────────
    SPLIT_TEXT_CHART    = "split_text_chart"      # 50% text | 50% chart
    DASHBOARD_3_CHARTS  = "dashboard_3_charts"    # 3-chart grid panel
    COMPARISON_TABLE    = "comparison_table"      # region vs national avg table
    KEY_METRICS         = "key_metrics"           # KPI card grid
    IMAGE_BACKGROUND    = "image_background"      # full-bleed title slide


class SeverityLevel(str, Enum):
    HIGH   = "high"
    MEDIUM = "medium"
    LOW    = "low"


class PresentationStatus(str, Enum):
    PENDING    = "pending"
    GENERATING = "generating"
    DONE       = "done"
    FAILED     = "failed"


# ─────────────────────────────────────────────────────────────────────────────
# Chart data (recharts-compatible)
# ─────────────────────────────────────────────────────────────────────────────

class ChartDataset(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str
    data:  list[float | int | None]
    color: Optional[str] = None


class ChartData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type:     str              # "bar" | "line" | "pie" | "area" | "composed"
    labels:   list[str]
    datasets: list[ChartDataset]
    unit:     Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Rich data models for agentic slides
# ─────────────────────────────────────────────────────────────────────────────

class YoYComparison(BaseModel):
    """Year-over-Year metric comparison — pre-computed by Python, not LLM."""
    model_config = ConfigDict(extra="ignore")

    metric:       str
    label:        str
    current_year: int
    prev_year:    int
    current_val:  float
    prev_val:     float
    delta_pct:    float
    direction:    str = "neutral"   # "up" | "down" | "neutral"
    unit:         Optional[str] = None


class NationalAvg(BaseModel):
    """Scope value vs system-wide average — pre-computed by Python."""
    model_config = ConfigDict(extra="ignore")

    metric:        str
    label:         str
    scope_val:     float
    national_avg:  float
    deviation_pct: float
    rank:          Optional[int] = None
    total_orgs:    Optional[int] = None
    unit:          Optional[str] = None


class KeyMetricItem(BaseModel):
    """Single KPI card for key_metrics slide."""
    model_config = ConfigDict(extra="ignore")

    label:     str
    value:     str             # pre-formatted string  e.g. "2 255"
    unit:      Optional[str]  = None
    delta_pct: Optional[float] = None
    direction: Optional[str]  = None   # "up" | "down" | "neutral"
    color:     Optional[str]  = None   # hint: "navy" | "cyan" | "purple"


class ComparisonRow(BaseModel):
    """Row in a comparison table slide."""
    model_config = ConfigDict(extra="ignore")

    name:           str
    values:         list[float | str | None]
    is_highlighted: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Anomaly record
# ─────────────────────────────────────────────────────────────────────────────

class AnomalyRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    org_name:    str
    field:       str
    period:      str
    value:       float | int | str
    expected:    Optional[float | int] = None
    deviation:   Optional[float] = None
    severity:    SeverityLevel = SeverityLevel.MEDIUM
    description: str


# ─────────────────────────────────────────────────────────────────────────────
# Core slide schema
# ─────────────────────────────────────────────────────────────────────────────

class SlideContent(BaseModel):
    """
    Atomic presentation unit — one rendered slide.

    extra="ignore" so the Orchestrator may include planning metadata
    (slide_index, data_focus, etc.) that gets silently dropped here.
    """
    model_config = ConfigDict(extra="ignore")

    slide_type: SlideType
    title:      str = Field(..., max_length=200)
    subtitle:   Optional[str] = Field(None, max_length=400)
    eyebrow:    Optional[str] = None      # UPPERCASE над-заголовок

    bullets:    list[str] = Field(default_factory=list)
    bg_style:   Optional[str] = None      # "navy" | "gradient" | "white" | "purple"

    # Charts (up to 3 for dashboard_3_charts)
    chart_data:   Optional[ChartData] = None
    chart_data_2: Optional[ChartData] = None
    chart_data_3: Optional[ChartData] = None

    # Structured data (pre-computed by Python, not LLM)
    anomalies:       list[AnomalyRecord]  = Field(default_factory=list)
    yoy_comparisons: list[YoYComparison]  = Field(default_factory=list)
    national_avgs:   list[NationalAvg]    = Field(default_factory=list)
    key_metrics:     list[KeyMetricItem]  = Field(default_factory=list)
    comparison_rows: list[ComparisonRow]  = Field(default_factory=list)
    comparison_cols: list[str]            = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Final report envelope
# ─────────────────────────────────────────────────────────────────────────────

class PresentationReport(BaseModel):
    model_config = ConfigDict(extra="ignore", protected_namespaces=())

    report_id:      int
    org_id:         Optional[UUID] = None
    org_name:       Optional[str]  = None
    region_name:    Optional[str]  = None
    org_type_name:  Optional[str]  = None
    period_year:    int
    focus:          Optional[str]  = None
    generated_at:   datetime
    model_used:     str = ""
    context_rows:   int = 0
    slides:         list[SlideContent]


# ─────────────────────────────────────────────────────────────────────────────
# API request / response
# ─────────────────────────────────────────────────────────────────────────────

class PresentationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    org_id:      Optional[UUID] = None
    region_id:   Optional[int]  = None
    org_type_id: Optional[int]  = None
    period_year: int             = Field(..., ge=2020, le=2030)
    focus:       Optional[str]  = Field(None, max_length=500)


class PresentationStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_id:      int
    status:         PresentationStatus
    celery_task_id: Optional[str] = None
    created_at:     datetime


class PresentationDetailResponse(PresentationStatusResponse):
    report:         Optional[PresentationReport] = None
    error_message:  Optional[str] = None
