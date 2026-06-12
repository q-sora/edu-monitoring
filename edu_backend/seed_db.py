import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

# Берем URL базы из окружения или ставим стандартный как в твоем api.py
DATABASE_URL = "postgresql+asyncpg://postgres:password@localhost:5432/edu_monitoring"

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def seed():
    async with AsyncSessionLocal() as session:
        try:
            print("🚀 Начинаю заполнение тестовыми данными...")

            # 1. Заполняем справочники (если пустые)
            await session.execute(text("""
                INSERT INTO org_types (code, name_ru) VALUES 
                ('ВиПО', 'Высшее и послевузовское образование'),
                ('ТиППО', 'Техническое и профессиональное образование')
                ON CONFLICT (code) DO NOTHING;
                
                INSERT INTO regions (name_ru) VALUES 
                ('г. Астана'), ('г. Алматы'), ('Карагандинская область')
                ON CONFLICT (name_ru) DO NOTHING;
            """))

            # 2. Получаем ID для связей
            res_type = await session.execute(text("SELECT id FROM org_types WHERE code='ВиПО' LIMIT 1"))
            org_type_id = res_type.scalar()
            
            res_reg = await session.execute(text("SELECT id FROM regions WHERE name_ru='г. Астана' LIMIT 1"))
            region_id = res_reg.scalar()

            # 3. Создаем тестовую организацию
            org_query = text("""
                INSERT INTO organizations (name_ru, bin, org_type_id, region_id, is_active)
                VALUES ('Международный IT Университет Тест', '123456789012', :ot_id, :r_id, true)
                ON CONFLICT (bin) DO UPDATE SET name_ru = EXCLUDED.name_ru
                RETURNING id
            """)
            result = await session.execute(org_query, {"ot_id": org_type_id, "r_id": region_id})
            org_id = result.scalar()

            # 4. Заполняем срез по студентам (Contingent)
            await session.execute(text("""
                INSERT INTO contingent_snapshots 
                (org_id, snapshot_date, total_count, budget_count, foreign_count)
                VALUES (:org_id, CURRENT_DATE, 2500, 850, 45)
            """), {"org_id": org_id})

            # 5. Заполняем научную деятельность
            await session.execute(text("""
                INSERT INTO science_activity 
                (org_id, period_year, publications_count, grant_funding_amount)
                VALUES (:org_id, 2024, 12, 25000000)
            """), {"org_id": org_id})

            await session.commit()
            print("✅ Все таблицы успешно заполнены!")
            
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(seed())

