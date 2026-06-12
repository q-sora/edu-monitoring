"""
models/anomalies.py
─────────────────────────────────────────────────────────────────────────────
ORM model for AI Anomaly Detection reports.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AnomalyReport(Base):
    __tablename__ = "anomaly_reports"

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True)
    sphere:       Mapped[str]            = mapped_column(String(50),  nullable=False)
    region_id:    Mapped[Optional[int]]  = mapped_column(Integer,     nullable=True)
    year:         Mapped[int]            = mapped_column(Integer,     nullable=False)
    severity:     Mapped[str]            = mapped_column(String(20),  nullable=False, default="warning")
    metric_name:  Mapped[str]            = mapped_column(String(200), nullable=False)
    metric_label: Mapped[Optional[str]]  = mapped_column(String(200), nullable=True)
    raw_value:    Mapped[Optional[float]] = mapped_column(Numeric,    nullable=True)
    expected_value: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    deviation_pct:  Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    z_score:        Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    trend_json:     Mapped[Optional[dict]]  = mapped_column(JSONB,   nullable=True)
    ai_explanation_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    status:       Mapped[str]            = mapped_column(String(20),  nullable=False, default="new")
    scan_run_at:  Mapped[datetime]       = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    created_at:   Mapped[datetime]       = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    __table_args__ = (
        Index("ix_anomaly_sphere",     "sphere"),
        Index("ix_anomaly_region_id",  "region_id"),
        Index("ix_anomaly_year",       "year"),
        Index("ix_anomaly_severity",   "severity"),
        Index("ix_anomaly_status",     "status"),
        Index("ix_anomaly_created_at", "created_at"),
    )
