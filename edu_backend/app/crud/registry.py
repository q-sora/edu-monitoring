"""
crud/registry.py
─────────────────────────────────────────────────────────────────────────────
Instantiates one BaseCRUD subclass per domain table.
All routers import their CRUD instance from here.

Adding a new domain table:
    1. Define ORM model in models/
    2. Define schemas in schemas/
    3. Add a CRUDClass here (3 lines)
    4. Create api/v1/<domain>.py using the router factory below
"""
from __future__ import annotations

from app.crud.base import BaseCRUD
from app.models.contingent import ContingentSnapshot
from app.models.education import EducationalProcess
from app.models.finance import FinanceRecord
from app.models.graduates import GraduatesRecord
from app.models.science import ScienceActivity
from app.models.school_rating import SchoolRatingSubmission
from app.services.school_rating import calculate_school_rating


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


class SchoolRatingCRUD(BaseCRUD[SchoolRatingSubmission]):
    MODEL = SchoolRatingSubmission
    UNIQUE_CONSTRAINT = "uq_school_rating_active"
    UNIQUE_FIELDS = ("school_id", "academic_year")
    CACHE_NAMESPACE = "school_rating"

    async def upsert(
        self, db: AsyncSession, *, org_id: UUID, data: Any, actor_id: str
    ) -> tuple[SchoolRatingSubmission, bool]:
        """Custom upsert that calculates scores."""
        scores = calculate_school_rating(data.raw_data)
        db_dict = data.model_dump(exclude_none=True)
        db_dict["school_id"] = org_id
        db_dict["scores"] = scores
        db_dict["submitted_by"] = UUID(actor_id) if actor_id != "system" else None

        update_cols = {
            k: v for k, v in db_dict.items()
            if k not in {"school_id", "academic_year", "created_at", "created_by"}
        }
        update_cols.update({"updated_by": actor_id, "updated_at": func.now()})

        from sqlalchemy.dialects.postgresql import insert as pg_insert
        stmt = (
            pg_insert(self.MODEL)
            .values(**db_dict, created_by=actor_id, updated_by=actor_id)
            .on_conflict_do_update(
                constraint=self.UNIQUE_CONSTRAINT,
                set_=update_cols,
            )
            .returning(self.MODEL)
        )
        async with db.begin():
            result = await db.execute(stmt)
            record = result.scalar_one()

        # ── SYNC WITH UNIFIED DATA CATALOG ───────────────────────────
        from sqlalchemy import text
        res_mapping = await db.execute(text("SELECT raw_data_key, catalog_field_id FROM school_rating_field_mapping"))
        sr_mapping = {r.raw_data_key: r.catalog_field_id for r in res_mapping.fetchall()}
        
        if sr_mapping:
            for key, field_id in sr_mapping.items():
                val = data.raw_data.get(key)
                if val is None:
                    continue
                
                # Convert string/bool/int to numeric for catalog
                try:
                    if isinstance(val, bool):
                        val_num = 1.0 if val else 0.0
                    else:
                        val_num = float(val)
                except (ValueError, TypeError):
                    continue

                await db.execute(text("""
                    INSERT INTO education_data (
                        org_id, catalog_field_id, period_year, value_numeric, 
                        imported_from, created_by, updated_by
                    ) VALUES (
                        :org_id, :field_id, :year, :val, 
                        'school_rating_sync', :uid, :uid
                    )
                    ON CONFLICT (org_id, catalog_field_id, period_year, period_month)
                    DO UPDATE SET
                        value_numeric = EXCLUDED.value_numeric,
                        updated_at = NOW(),
                        version = education_data.version + 1
                """), {
                    "org_id": str(org_id), "field_id": field_id, 
                    "year": data.academic_year, "val": val_num, 
                    "uid": actor_id if actor_id != "system" else None
                })
        
        created = record.version == 1
        return record, created


# Singleton instances — import these in routers
science_crud    = ScienceCRUD()
contingent_crud = ContingentCRUD()
finance_crud    = FinanceCRUD()
graduates_crud  = GraduatesCRUD()
education_crud  = EducationCRUD()
school_rating_crud = SchoolRatingCRUD()
