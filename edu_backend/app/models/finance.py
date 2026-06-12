"""
models/finance.py — finance_records ORM model
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, Date, ForeignKey, Index, Integer, Numeric,
    SmallInteger, String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import FullAuditMixin


class FinanceRecord(FullAuditMixin, Base):
    """UNIQUE(org_id, period_year, period_month)"""
    __tablename__ = "finance_records"
    __table_args__ = (
        UniqueConstraint("org_id", "period_year", "period_month",
                         name="uq_finance_org_year_month"),
        Index("ix_finance_active", "org_id", "period_year",
              postgresql_where=text("deleted_at IS NULL")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True
    )

    period_year:  Mapped[int]           = mapped_column(SmallInteger, nullable=False)
    period_month: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    # JSONB
    funding_sources_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # Volumes
    annual_budget:               Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    state_order_volume:          Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    extra_budget_income:         Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    per_capita_norm:             Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    state_order_start_date:      Mapped[Optional[date]]    = mapped_column(Date)
    state_order_end_date:        Mapped[Optional[date]]    = mapped_column(Date)
    state_order_planned_amount:  Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    vouchers_issued:             Mapped[Optional[int]]     = mapped_column(Integer)
    payments_to_suppliers:       Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    violations_info:             Mapped[Optional[str]]     = mapped_column(Text)
    return_notification_amount:  Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    return_reason:               Mapped[Optional[str]]     = mapped_column(Text)

    # Expenses
    expenses_utilities:          Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_payroll:            Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_antiterror:         Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_food:               Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_medical:            Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_retraining:         Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_olympiads:          Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_extra_education:    Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_special_equipment:  Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_transport:          Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_rnd:                Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_scholarships:       Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    expenses_boarding:           Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))

    circle_price_per_session:    Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    paid_services_price:         Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    paid_vs_free_ratio:          Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    budget_execution_report_url: Mapped[Optional[str]]     = mapped_column(Text)
    payment_orders_count:        Mapped[Optional[int]]     = mapped_column(Integer)
    financing_requests_count:    Mapped[Optional[int]]     = mapped_column(Integer)

    submission_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )
