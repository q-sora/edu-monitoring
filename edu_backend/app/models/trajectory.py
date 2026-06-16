"""
models/trajectory.py — student-level trajectory ORM models
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, ForeignKey,
    Index, Integer, Numeric, SmallInteger, String, Text,
    UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import FullAuditMixin


class StudentRegistry(FullAuditMixin, Base):
    """
    Реестр студентов — базовые данные из НЦТ.
    UNIQUE(iin) — один студент идентифицируется по ИИН.
    """
    __tablename__ = "student_registry"
    __table_args__ = (
        UniqueConstraint("iin", name="uq_student_iin"),
        Index("ix_student_registry_active", "org_id", "graduation_year",
              postgresql_where=text("deleted_at IS NULL")),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    iin: Mapped[str] = mapped_column(String(12), nullable=False)
    org_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True,
    )

    education_level: Mapped[str] = mapped_column(String(20), nullable=False)
    specialty_code: Mapped[Optional[str]] = mapped_column(String(50))
    specialty_name: Mapped[Optional[str]] = mapped_column(Text)
    graduation_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    enrollment_year: Mapped[Optional[int]] = mapped_column(SmallInteger)
    ent_score: Mapped[Optional[int]] = mapped_column(SmallInteger)
    is_grant: Mapped[Optional[bool]] = mapped_column(Boolean)
    tuition_cost_annual: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    total_budget_spent: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))


class StudentAcademic(Base):
    """GPA по семестрам из АИС вузов/ТиПО. UNIQUE(iin, academic_year, semester_number)."""
    __tablename__ = "student_academic"
    __table_args__ = (
        UniqueConstraint("iin", "academic_year", "semester_number", name="uq_student_academic"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    iin: Mapped[str] = mapped_column(
        String(12), ForeignKey("student_registry.iin", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True,
    )
    academic_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    semester_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    gpa: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    credits_earned: Mapped[Optional[int]] = mapped_column(SmallInteger)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )


class StudentEmployment(Base):
    """Занятость выпускника из МТСЗН (реестр ОСМС/ЕНСС). UNIQUE(iin, period_year)."""
    __tablename__ = "student_employment"
    __table_args__ = (
        UniqueConstraint("iin", "period_year", name="uq_student_employment"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    iin: Mapped[str] = mapped_column(
        String(12), ForeignKey("student_registry.iin", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True,
    )
    period_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    employment_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="unknown",
    )
    employment_date: Mapped[Optional[date]] = mapped_column(Date)
    employer_name: Mapped[Optional[str]] = mapped_column(Text)
    employer_bin: Mapped[Optional[str]] = mapped_column(String(12))
    employer_oked: Mapped[Optional[str]] = mapped_column(String(10))
    region_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("regions.id", ondelete="SET NULL"), nullable=True,
    )
    specialty_match: Mapped[Optional[bool]] = mapped_column(Boolean)
    months_to_employ: Mapped[Optional[int]] = mapped_column(SmallInteger)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )


class StudentSalary(Base):
    """Зарплата и налоги из КГД + пенсионные из ГЦВП. UNIQUE(iin, year, quarter, source_type)."""
    __tablename__ = "student_salary"
    __table_args__ = (
        UniqueConstraint("iin", "period_year", "period_quarter", "source_type",
                         name="uq_student_salary"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    iin: Mapped[str] = mapped_column(
        String(12), ForeignKey("student_registry.iin", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True,
    )
    period_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period_quarter: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    salary_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    ipn_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    pension_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    income_source: Mapped[Optional[str]] = mapped_column(
        String(20), server_default="hire",
    )
    employer_oked: Mapped[Optional[str]] = mapped_column(String(10))
    source_type: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="kgd",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
