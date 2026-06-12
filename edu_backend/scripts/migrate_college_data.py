
import asyncio
import logging
from uuid import UUID
from sqlalchemy import text
from app.core.database import get_db_context

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate():
    async with get_db_context() as db:
        # 1. Get mappings
        res_mapping = await db.execute(text("SELECT ca_column, catalog_field_id FROM college_assessment_field_mapping"))
        ca_mapping = {r.ca_column: r.catalog_field_id for r in res_mapping.fetchall()}
        
        if not ca_mapping:
            logger.info("No mappings found in college_assessment_field_mapping. Skipping migration.")
            return

        # 2. Get organizations map
        res_orgs = await db.execute(text("SELECT id, name_ru FROM organizations WHERE name_ru IS NOT NULL"))
        name_to_org_id = {r.name_ru.strip().lower(): r.id for r in res_orgs.fetchall()}

        # 3. Get existing college assessment data
        res_data = await db.execute(text("SELECT * FROM college_assessment"))
        rows = res_data.mappings().all()
        
        logger.info(f"Found {len(rows)} records in college_assessment.")
        
        migrated_count = 0
        for row in rows:
            org_id = row["org_id"]
            if not org_id:
                college_name = row["college_name"]
                if college_name:
                    org_id = name_to_org_id.get(college_name.strip().lower())
            
            if not org_id:
                logger.warning(f"Could not find org_id for college: {row['college_name']}")
                continue

            year = row["period_year"]
            src = row["source_file"] or "manual_migration"
            uid = row["imported_by"]
            
            for col, field_id in ca_mapping.items():
                val = row.get(col)
                if val is None:
                    continue
                
                if isinstance(val, bool):
                    val_num = 1.0 if val else 0.0
                else:
                    try:
                        val_num = float(val)
                    except (ValueError, TypeError):
                        continue

                await db.execute(text("""
                    INSERT INTO education_data (
                        org_id, catalog_field_id, period_year, value_numeric, 
                        imported_from, source_file, created_by, updated_by
                    ) VALUES (
                        :org_id, :field_id, :year, :val, 
                        'college_assessment_migration', :src, :uid, :uid
                    )
                    ON CONFLICT (org_id, catalog_field_id, period_year, period_month)
                    DO UPDATE SET
                        value_numeric = EXCLUDED.value_numeric,
                        updated_at = NOW(),
                        version = education_data.version + 1
                """), {
                    "org_id": org_id, "field_id": field_id, 
                    "year": year, "val": val_num, 
                    "src": src, "uid": uid
                })
                migrated_count += 1
        
        await db.commit()
        logger.info(f"Successfully migrated {migrated_count} data points to education_data.")

if __name__ == "__main__":
    asyncio.run(migrate())
