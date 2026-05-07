"""
schemas/finance.py
─────────────────────────────────────────────────────────────────────────────
Полная Pydantic-схема для FinanceRecord.

13 вкладок ≈ 100 полей.
JSONB: grants_json (массив грантов с источниками)

Заменяет существующий app/schemas/finance.py.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# Вложенная схема для grants_json
# ─────────────────────────────────────────────────────────────────────────────

class GrantItem(BaseModel):
    """Один элемент массива grants_json."""
    name:       str = Field(..., min_length=2, max_length=300, description="Название гранта")
    amount:     Decimal = Field(..., ge=0, description="Сумма в тенге")
    source:     str = Field(..., max_length=200, description="Источник финансирования (ФЦ, БРК, NIH, EU и т.д.)")
    start_date: Optional[date] = None
    end_date:   Optional[date] = None
    status:     str = Field(default="active", description="active / completed / suspended")
    leader:     Optional[str] = Field(None, max_length=200, description="Руководитель проекта")

    model_config = ConfigDict(extra="forbid")


# ─────────────────────────────────────────────────────────────────────────────
# Базовая схема — 100+ полей
# ─────────────────────────────────────────────────────────────────────────────

class FinanceBase(BaseModel):
    """Все суммы в тенге если не указано иное. Все поля кроме ключевых опциональны."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    # ── Вкладка 1: Общие ────────────────────────────────────────────
    period_year:     int = Field(..., ge=2015, le=2035)
    period_quarter:  Optional[int] = Field(None, ge=1, le=4, description="1..4 или null для года")
    report_date:     Optional[date] = None
    currency_code:   str = Field(default="KZT", max_length=3)
    exchange_rate:   Optional[Decimal] = Field(None, ge=0, description="Курс к KZT")

    # ── Вкладка 2: ДОХОДЫ — Бюджет ──────────────────────────────────
    budget_total:               Optional[Decimal] = Field(None, ge=0)
    budget_state_grant:         Optional[Decimal] = Field(None, ge=0, description="Образовательный гос. грант")
    budget_target_funding:      Optional[Decimal] = Field(None, ge=0)
    budget_capital_investment:  Optional[Decimal] = Field(None, ge=0)
    budget_research_subsidy:    Optional[Decimal] = Field(None, ge=0)
    budget_social_program:      Optional[Decimal] = Field(None, ge=0)

    # ── Вкладка 3: ДОХОДЫ — Платное обучение ────────────────────────
    paid_tuition_total:    Optional[Decimal] = Field(None, ge=0)
    paid_tuition_bachelor: Optional[Decimal] = Field(None, ge=0)
    paid_tuition_master:   Optional[Decimal] = Field(None, ge=0)
    paid_tuition_phd:      Optional[Decimal] = Field(None, ge=0)
    paid_tuition_foreign:  Optional[Decimal] = Field(None, ge=0)
    paid_tuition_avg_cost: Optional[Decimal] = Field(None, ge=0, description="Средняя стоимость обучения за год")

    # ── Вкладка 4: ДОХОДЫ — Гранты и контракты ─────────────────────
    research_grants_total:      Optional[Decimal] = Field(None, ge=0)
    research_grants_count:      Optional[int]     = Field(None, ge=0)
    international_grants:       Optional[Decimal] = Field(None, ge=0)
    international_grants_count: Optional[int]     = Field(None, ge=0)
    commercial_contracts:       Optional[Decimal] = Field(None, ge=0)
    commercial_contracts_count: Optional[int]     = Field(None, ge=0)
    grants_json:                list[GrantItem]   = Field(default_factory=list)

    # ── Вкладка 5: ДОХОДЫ — Эндаумент и частные ────────────────────
    endowment_balance:     Optional[Decimal] = Field(None, ge=0)
    endowment_income:      Optional[Decimal] = Field(None, ge=0)
    donations_total:       Optional[Decimal] = Field(None, ge=0)
    alumni_donations:      Optional[Decimal] = Field(None, ge=0)
    corporate_sponsorship: Optional[Decimal] = Field(None, ge=0)

    # ── Вкладка 6: ДОХОДЫ — Прочие ─────────────────────────────────
    rent_income:        Optional[Decimal] = Field(None, ge=0)
    hostel_income:      Optional[Decimal] = Field(None, ge=0)
    service_income:     Optional[Decimal] = Field(None, ge=0)
    publication_income: Optional[Decimal] = Field(None, ge=0)
    other_income:       Optional[Decimal] = Field(None, ge=0)
    total_income:       Optional[Decimal] = Field(None, ge=0, description="ИТОГО доходов")

    # ── Вкладка 7: РАСХОДЫ — ФОТ ───────────────────────────────────
    salary_fund_total:     Optional[Decimal] = Field(None, ge=0)
    salary_teaching_staff: Optional[Decimal] = Field(None, ge=0)
    salary_administrative: Optional[Decimal] = Field(None, ge=0)
    salary_research_staff: Optional[Decimal] = Field(None, ge=0)
    salary_support_staff:  Optional[Decimal] = Field(None, ge=0)
    social_tax:            Optional[Decimal] = Field(None, ge=0)
    bonuses_total:         Optional[Decimal] = Field(None, ge=0)
    avg_salary_teaching:   Optional[Decimal] = Field(None, ge=0)
    avg_salary_research:   Optional[Decimal] = Field(None, ge=0)

    # ── Вкладка 8: РАСХОДЫ — Капвложения ───────────────────────────
    capex_total:        Optional[Decimal] = Field(None, ge=0)
    capex_construction: Optional[Decimal] = Field(None, ge=0)
    capex_equipment:    Optional[Decimal] = Field(None, ge=0)
    capex_it_systems:   Optional[Decimal] = Field(None, ge=0)
    capex_library:      Optional[Decimal] = Field(None, ge=0)
    capex_laboratory:   Optional[Decimal] = Field(None, ge=0)

    # ── Вкладка 9: РАСХОДЫ — Операционные ──────────────────────────
    opex_utilities:   Optional[Decimal] = Field(None, ge=0)
    opex_maintenance: Optional[Decimal] = Field(None, ge=0)
    opex_consumables: Optional[Decimal] = Field(None, ge=0)
    opex_travel:      Optional[Decimal] = Field(None, ge=0)
    opex_advertising: Optional[Decimal] = Field(None, ge=0)
    opex_other:       Optional[Decimal] = Field(None, ge=0)

    # ── Вкладка 10: РАСХОДЫ — Студенческая поддержка ─────────────
    scholarship_total:  Optional[Decimal] = Field(None, ge=0)
    scholarship_state:  Optional[Decimal] = Field(None, ge=0)
    scholarship_named:  Optional[Decimal] = Field(None, ge=0)
    scholarship_social: Optional[Decimal] = Field(None, ge=0)
    hostel_subsidy:     Optional[Decimal] = Field(None, ge=0)
    food_subsidy:       Optional[Decimal] = Field(None, ge=0)
    travel_subsidy:     Optional[Decimal] = Field(None, ge=0)

    # ── Вкладка 11: РАСХОДЫ — Наука и международные ───────────────
    research_expenses:      Optional[Decimal] = Field(None, ge=0)
    conference_expenses:    Optional[Decimal] = Field(None, ge=0)
    publication_expenses:   Optional[Decimal] = Field(None, ge=0)
    international_mobility: Optional[Decimal] = Field(None, ge=0)
    partnership_fees:       Optional[Decimal] = Field(None, ge=0)
    total_expenses:         Optional[Decimal] = Field(None, ge=0, description="ИТОГО расходов")

    # ── Вкладка 12: Ключевые коэффициенты ──────────────────────────
    cost_per_student:        Optional[Decimal] = Field(None, ge=0)
    fot_to_budget_ratio:     Optional[Decimal] = Field(None, ge=0, le=200, description="%")
    state_funding_ratio:     Optional[Decimal] = Field(None, ge=0, le=100, description="%")
    commercial_ratio:        Optional[Decimal] = Field(None, ge=0, le=100, description="%")
    research_to_total_ratio: Optional[Decimal] = Field(None, ge=0, le=100, description="%")

    # ── Вкладка 13: Эффективность и аудит ──────────────────────────
    audit_passed:          Optional[bool] = None
    audit_company:         Optional[str]  = Field(None, max_length=200)
    audit_date:            Optional[date] = None
    budget_execution_pct:  Optional[Decimal] = Field(None, ge=0, le=200, description="%")
    deficit_amount:        Optional[Decimal] = Field(None, description="Может быть отрицательным")
    reserve_fund:          Optional[Decimal] = Field(None, ge=0)


class FinanceCreate(FinanceBase):
    pass


class FinanceRead(FinanceBase):
    id: int
    org_id: UUID
    submission_status: str = "draft"
    version: int = 1
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, extra="ignore")


class FinanceListResponse(BaseModel):
    items: list[FinanceRead]
    total: int
    limit: int
    offset: int


# Backward-compatible aliases (routers.py uses these names)
FinanceRecordCreate = FinanceCreate
FinanceRecordUpdate = FinanceCreate
FinanceRecordResponse = FinanceRead
