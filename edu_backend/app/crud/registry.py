"""
crud/registry.py
─────────────────────────────────────────────────────────────────────────────
Instantiates one BaseCRUD subclass per domain table.
All routers import their CRUD instance from here.
"""
from __future__ import annotations

from app.crud.base import BaseCRUD
from app.models.contingent import ContingentSnapshot
from app.models.education import EducationalProcess
from app.models.finance import FinanceRecord
from app.models.graduates import GraduatesRecord
from app.models.science import ScienceActivity


class ScienceCRUD(BaseCRUD[ScienceActivity]):
    MODEL = ScienceActivity
    UNIQUE_CONSTRAINT = "uq_science_org_year"
    UNIQUE_FIELDS = ("org_id", "period_year")
    CACHE_NAMESPACE = "science"


class ContingentCRUD(BaseCRUD[ContingentSnapshot]):
    MODEL = ContingentSnapshot
    UNIQUE_CONSTRAINT = "uq_contingent_org_date"
    UNIQUE_FIELDS = ("org_id", "snapshot_date")
    CACHE_NAMESPACE = "contingent"
    CACHE_TTL = 60   # contingent changes frequently — shorter TTL


class FinanceCRUD(BaseCRUD[FinanceRecord]):
    MODEL = FinanceRecord
    UNIQUE_CONSTRAINT = "uq_finance_org_year_month"
    UNIQUE_FIELDS = ("org_id", "period_year", "period_month")
    CACHE_NAMESPACE = "finance"


class GraduatesCRUD(BaseCRUD[GraduatesRecord]):
    MODEL = GraduatesRecord
    UNIQUE_CONSTRAINT = "uq_graduates_org_year"
    UNIQUE_FIELDS = ("org_id", "graduation_year")
    CACHE_NAMESPACE = "graduates"


class EducationCRUD(BaseCRUD[EducationalProcess]):
    MODEL = EducationalProcess
    UNIQUE_CONSTRAINT = "uq_education_org_date"
    UNIQUE_FIELDS = ("org_id", "snapshot_date")
    CACHE_NAMESPACE = "education"


# Singleton instances — import these in routers
science_crud    = ScienceCRUD()
contingent_crud = ContingentCRUD()
finance_crud    = FinanceCRUD()
graduates_crud  = GraduatesCRUD()
education_crud  = EducationCRUD()
