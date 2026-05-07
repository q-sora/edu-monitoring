import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Настройка подключения
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required. See .env.example")

if "asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def seed():
    async with AsyncSessionLocal() as session:
        try:
            print(f"📡 Подключение к базе: {DATABASE_URL.split('@')[-1]}")

            # 1. Очищаем только операционные данные (организации и их статистику)
            # Мы НЕ трогаем справочники регионов и типов, чтобы не ломать ID
            print("🧹 Очистка старых тестовых организаций...")
            await session.execute(text("TRUNCATE TABLE contingent_snapshots CASCADE;"))
            await session.execute(text("TRUNCATE TABLE science_activity CASCADE;"))
            await session.execute(text("TRUNCATE TABLE organizations RESTART IDENTITY CASCADE;"))

            # 2. Проверяем наличие типов организаций (ВиПО / ТиППО)
            print("📚 Проверка справочников...")
            await session.execute(text("""
                INSERT INTO org_types (code, name_ru) VALUES 
                ('ВиПО', 'Высшее и послевузовское образование'),
                ('ТиППО', 'Техническое и профессиональное образование')
                ON CONFLICT (code) DO NOTHING;
            """))

            # 3. Получаем ID региона и типа (Астана и ВиПО)
            # Если их нет - создаем, если есть - просто берем ID
            res_type = await session.execute(text("SELECT id FROM org_types WHERE code='ВиПО' LIMIT 1"))
            org_type_id = res_type.scalar()
            
            # Проверяем регион. Если его нет - вставляем.
            res_reg = await session.execute(text("SELECT id FROM regions WHERE name_ru LIKE '%Астана%' LIMIT 1"))
            region_id = res_reg.scalar()
            
            if not region_id:
                print("📍 Регион не найден, создаю новый...")
                res_reg = await session.execute(text("""
                    INSERT INTO regions (code, name_ru, type) 
                    VALUES ('AST', 'г. Астана', 'city') 
                    RETURNING id
                """))
                region_id = res_reg.scalar()

            print(f"✅ Используем TypeID: {org_type_id}, RegionID: {region_id}")

            # 4. Создаем 3 тестовых ВУЗа
            print("🏛️ Создание организаций и их показателей...")
            for i in range(1, 4):
                org_name = f"Тестовый Университет №{i}"
                bin_num = f"99010100000{i}"
                
                result = await session.execute(text("""
                    INSERT INTO organizations (name_ru, bin, org_type_id, region_id)
                    VALUES (:name, :bin, :ot_id, :r_id)
                    RETURNING id
                """), {"name": org_name, "bin": bin_num, "ot_id": org_type_id, "r_id": region_id})
                org_id = result.scalar()

                # 5. Заполняем Контингент (таблица из вашей схемы)
                await session.execute(text("""
                    INSERT INTO contingent_snapshots 
                    (org_id, snapshot_date, total_count, budget_count, foreign_count)
                    VALUES (:org_id, CURRENT_DATE, :total, :budget, :foreign)
                """), {
                    "org_id": org_id, 
                    "total": 1000 * i, 
                    "budget": 300 * i, 
                    "foreign": 50 * i
                })
                
                # 6. Заполняем Науку
                # Используем только те колонки, которые точно есть (из прошлых ошибок)
                await session.execute(text("""
                    INSERT INTO science_activity (org_id, period_year, grant_funding_amount)
                    VALUES (:org_id, 2024, :money)
                """), {
                    "org_id": org_id,
                    "money": 5000000 * i
                })

            await session.commit()
            print("\n🎉 ПОБЕДА! База заполнена тестовыми ВУЗами.")
            print("Теперь зайди в Дашборд на сайте — там должны быть цифры.")
            
        except Exception as e:
            print(f"\n❌ ОШИБКА: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(seed())

