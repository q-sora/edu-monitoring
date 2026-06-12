
import asyncio
from sqlalchemy import text
from app.core.database import get_db_context

COLLEGE_FIELDS = [
    "repair_current_done", "repair_not_required", "repair_capital_done",
    "repair_capital_needed", "repair_current_needed", "capacity_design",
    "contingent_actual", "has_sports_facility", "has_dormitory",
    "library_readers_count", "mini_enterprise_count", "mini_enterprise_income",
    "sponsor_funds", "has_methodical_union", "teachers_master_count",
    "teachers_science_count", "teachers_total", "talap_trainers_count",
    "best_teacher_winners", "enterprise_patronage_count"
]

async def check_fields():
    async with get_db_context() as db:
        for f in COLLEGE_FIELDS:
            # Try fuzzy search or exact name
            name_guess = f.replace("_", " ")
            res = await db.execute(text(
                "SELECT id, field_name FROM data_catalog WHERE field_name ILIKE :n AND education_level = 'tippo'"
            ), {"n": f"%{name_guess}%"})
            matches = res.fetchall()
            if matches:
                print(f"FOUND: {f} -> {[m.field_name for m in matches]}")
            else:
                print(f"MISSING: {f}")

if __name__ == "__main__":
    asyncio.run(check_fields())
