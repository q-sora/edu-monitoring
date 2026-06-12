
import asyncio
from uuid import uuid4
from sqlalchemy import text
from app.core.database import get_db_context

async def seed_colleges():
    async with get_db_context() as db:
        # Get names from college_assessment
        res = await db.execute(text("SELECT DISTINCT college_name FROM college_assessment"))
        names = [r.college_name for r in res.fetchall() if r.college_name]
        
        print(f"Found {len(names)} colleges to seed.")
        
        for name in names:
            await db.execute(text("""
                INSERT INTO organizations (id, name_ru, org_type_id, status)
                SELECT :id, :name, 4, 'active'
                WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name_ru = :name)
            """), {"id": str(uuid4()), "name": name})
        
        await db.commit()
        print("Seeding complete.")

if __name__ == "__main__":
    asyncio.run(seed_colleges())
