import os
import sqlite3

def main():
    db_file = r"C:\Users\Arslan\Documents\praktika2\edu-monitoring\edu_monitoring.db"
    
    # Remove existing database if any, to start fresh
    if os.path.exists(db_file):
        os.remove(db_file)
        print("Removed existing SQLite database.")
        
    print(f"Creating SQLite database: {db_file}")
    conn = sqlite3.connect(db_file)
    cur = conn.cursor()
    
    # ── 1. CREATE TABLES ──────────────────────────────────────────────────────
    print("Creating tables...")
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS regions (
            id INTEGER PRIMARY KEY,
            code TEXT,
            name_ru TEXT,
            type TEXT
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS org_types (
            id INTEGER PRIMARY KEY,
            code TEXT,
            name_ru TEXT
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ownership_forms (
            id INTEGER PRIMARY KEY,
            code TEXT,
            name_ru TEXT
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            bin TEXT,
            name_ru TEXT,
            org_type_id INTEGER,
            region_id INTEGER,
            ownership_form_id INTEGER,
            status TEXT DEFAULT 'active',
            address_full TEXT,
            activity_start_date TEXT,
            vuz_status TEXT,
            system_account_id TEXT
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS api_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_hash TEXT,
            org_id TEXT,
            name TEXT,
            scopes TEXT,
            is_active INTEGER DEFAULT 1,
            last_used_at TEXT,
            expires_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS form_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id TEXT NOT NULL,
            domain TEXT NOT NULL,
            period_year INTEGER,
            period_month INTEGER,
            period_quarter INTEGER,
            snapshot_date TEXT,
            academic_year INTEGER,
            payload_json TEXT NOT NULL,
            submission_status TEXT NOT NULL DEFAULT 'draft',
            submitted_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_by TEXT
        )
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS ix_form_records_org_domain
        ON form_records (org_id, domain, updated_at)
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS ix_form_records_status
        ON form_records (submission_status, updated_at)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            user_email TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS contingent_snapshots (
            org_id TEXT,
            snapshot_date TEXT,
            total_count INTEGER,
            new_enrolled INTEGER,
            withdrawn INTEGER,
            bachelor_count INTEGER,
            master_count INTEGER,
            phd_count INTEGER,
            full_time_count INTEGER,
            distance_count INTEGER,
            budget_count INTEGER,
            paid_count INTEGER,
            by_grade_json TEXT,
            by_specialty_json TEXT,
            kz_lang_count INTEGER,
            ru_lang_count INTEGER,
            en_lang_count INTEGER,
            other_lang_count INTEGER,
            many_children_count INTEGER,
            low_income_count INTEGER,
            disabled_count INTEGER,
            orphan_count INTEGER,
            oop_count INTEGER,
            foreign_count INTEGER,
            privileged_share REAL,
            boarding_school_count INTEGER,
            prize_winners_json TEXT,
            absences_count INTEGER,
            submission_status TEXT DEFAULT 'approved',
            created_at TEXT,
            version INTEGER,
            PRIMARY KEY (org_id, snapshot_date)
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS finance_records (
            org_id TEXT,
            period_year INTEGER,
            period_month INTEGER,
            period_quarter INTEGER,
            report_date TEXT,
            annual_budget REAL,
            state_order_volume REAL,
            extra_budget_income REAL,
            per_capita_norm REAL,
            state_order_planned_amount REAL,
            vouchers_issued INTEGER,
            payments_to_suppliers REAL,
            expenses_payroll REAL,
            expenses_utilities REAL,
            expenses_food REAL,
            expenses_medical REAL,
            expenses_rnd REAL,
            expenses_scholarships REAL,
            expenses_retraining REAL,
            expenses_transport REAL,
            paid_vs_free_ratio REAL,
            payment_orders_count INTEGER,
            financing_requests_count INTEGER,
            currency_code TEXT DEFAULT 'KZT',
            violations_info TEXT,
            funding_sources_json TEXT,
            submission_status TEXT DEFAULT 'approved',
            created_at TEXT,
            version INTEGER,
            updated_at_flag TEXT,
            PRIMARY KEY (org_id, period_year, period_month)
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS staff_snapshots (
            org_id TEXT,
            snapshot_date TEXT,
            total_teachers INTEGER,
            spec_teachers_count INTEGER,
            external_examiners INTEGER,
            avg_workload_hours REAL,
            staffing_rate REAL,
            teacher_child_ratio REAL,
            avg_experience_years REAL,
            turnover_rate REAL,
            trained_count INTEGER,
            certified_count INTEGER,
            contest_participants INTEGER,
            qualification_json TEXT,
            contest_results_json TEXT,
            staffing_plan_json TEXT,
            PRIMARY KEY (org_id, snapshot_date)
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS infrastructure_records (
            org_id TEXT,
            snapshot_date TEXT,
            design_capacity INTEGER,
            building_area_sqm REAL,
            construction_year INTEGER,
            building_condition_wear_pct REAL,
            sanpin_compliance INTEGER,
            has_library INTEGER,
            has_canteen INTEGER,
            has_internet INTEGER,
            has_shuttle INTEGER,
            technical_condition TEXT,
            heating_type TEXT,
            building_type TEXT,
            edu_infra_details_json TEXT,
            sports_infra_json TEXT,
            PRIMARY KEY (org_id, snapshot_date)
        )
    """)

    # Missing Tables: gons_daily_snapshot, dormitory_residents, fraud_checks
    cur.execute("""
        CREATE TABLE IF NOT EXISTS gons_daily_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            institution_id INTEGER,
            snapshot_date TEXT NOT NULL,
            deposits_aquyl_count INTEGER,
            insurance_contracts_count INTEGER,
            deposits_aquyl_total_amount REAL,
            insurance_premiums_total REAL,
            state_bonus_total REAL,
            sok_total REAL,
            created_at TEXT,
            UNIQUE (institution_id, snapshot_date)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS dormitory_residents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dormitory_id TEXT,
            student_iin TEXT NOT NULL,
            student_org_id TEXT,
            check_in_date TEXT,
            check_out_date TEXT,
            is_current INTEGER DEFAULT 1,
            created_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS fraud_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id TEXT,
            check_date TEXT NOT NULL,
            check_type TEXT,
            checked_count INTEGER,
            discrepancy_count INTEGER,
            discrepancy_details TEXT,
            created_at TEXT
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS field_registry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            field_code TEXT NOT NULL,
            section_code TEXT NOT NULL,
            section_name TEXT,
            field_name TEXT,
            org_type_code TEXT NOT NULL,
            is_enabled INTEGER DEFAULT 1,
            source_id INTEGER,
            frequency_id INTEGER,
            db_table TEXT,
            db_column TEXT,
            UNIQUE (field_code, section_code, org_type_code)
        )
    """)

    # ── 1.1 CREATE VIEWS ──────────────────────────────────────────────────────
    print("Creating views...")
    cur.execute("""
        CREATE VIEW IF NOT EXISTS vw_org_summary AS
        SELECT
            o.id,
            o.bin,
            o.name_ru,
            ot.code   AS org_type,
            of2.name_ru AS ownership,
            r.name_ru AS region,
            NULL AS locality,
            o.address_full,
            o.status,
            (SELECT MAX(c.snapshot_date) FROM contingent_snapshots c WHERE c.org_id = o.id) AS last_contingent_date,
            (SELECT c.total_count FROM contingent_snapshots c WHERE c.org_id = o.id ORDER BY c.snapshot_date DESC LIMIT 1) AS current_students
        FROM organizations o
        LEFT JOIN org_types ot ON ot.id = o.org_type_id
        LEFT JOIN ownership_forms of2 ON of2.id = o.ownership_form_id
        LEFT JOIN regions r ON r.id = o.region_id;
    """)
    
    # ── 2. SEED DATA ──────────────────────────────────────────────────────────
    print("Seeding lookup tables...")
    
    # Regions
    regions = [
        (1,'AST','Астана','city'),
        (2,'ALA','Алматы','city'),
        (3,'SHY','Шымкент','city'),
        (4,'AKM','Акмолинская','oblast'),
        (5,'AKT','Актюбинская','oblast'),
        (6,'ALM','Алматинская','oblast'),
        (7,'ATY','Атырауская','oblast'),
        (8,'ZKZ','Западно-Казахстанская','oblast'),
        (9,'ZHB','Жамбылская','oblast'),
        (10,'ZHT','Жетісу','oblast'),
        (11,'KAR','Карагандинская','oblast'),
        (12,'KOS','Костанайская','oblast'),
        (13,'KZO','Кызылординская','oblast'),
        (14,'MAN','Мангистауская','oblast'),
        (15,'PAV','Павлодарская','oblast'),
        (16,'SKZ','Северо-Казахстанская','oblast'),
        (17,'TUR','Туркестанская','oblast'),
        (18,'ULT','Ұлытау','oblast'),
        (19,'ABY','Абай','oblast'),
        (20,'EKB','Восточно-Казахстанская','oblast'),
    ]
    cur.executemany("INSERT INTO regions (id, code, name_ru, type) VALUES (?,?,?,?)", regions)
    
    # Org types
    org_types = [
        (1, 'ДО', 'Дошкольное образование'),
        (2, 'ДопО', 'Дополнительное образование'),
        (3, 'СО', 'Среднее образование'),
        (4, 'ТиППО', 'ТиППО'),
        (5, 'ВиПО', 'ВиПО'),
        (6, 'Общ-е', 'Общежития'),
        (7, 'ГОНС', 'ГОНС')
    ]
    cur.executemany("INSERT INTO org_types (id, code, name_ru) VALUES (?,?,?)", org_types)
    
    # Ownership forms
    ownerships = [
        (1, 'state', 'Государственная'),
        (2, 'private', 'Частная')
    ]
    cur.executemany("INSERT INTO ownership_forms (id, code, name_ru) VALUES (?,?,?)", ownerships)
    
    # Organizations
    orgs = [
        ('11000000-0000-0000-0000-000000000001','040000000001','КазНУ им. аль-Фараби',5,2,2),
        ('11000000-0000-0000-0000-000000000002','010000000002','ЕНУ им. Л.Н. Гумилёва',5,1,2),
        ('11000000-0000-0000-0000-000000000003','040000000003','КазНТУ им. К.И. Сатпаева',5,2,2),
        ('11000000-0000-0000-0000-000000000004','010000000004','Назарбаев Университет',5,1,2),
    ]
    for o in orgs:
        cur.execute("""
            INSERT INTO organizations (id, bin, name_ru, org_type_id, region_id, ownership_form_id)
            VALUES (?,?,?,?,?,?)
        """, o)
        
    # Default API token
    cur.execute("""
        INSERT INTO api_tokens (token_hash, org_id, name, scopes, is_active)
        VALUES ('test_api_key', '11000000-0000-0000-0000-000000000001', 'Test User', 'read,write,admin', 1)
    """)

    # Seed field_registry from SQL file
    registry_sql_path = r"C:\Users\Arslan\Documents\praktika2\edu-monitoring\edu_field_registry.sql"
    if os.path.exists(registry_sql_path):
        print(f"Reading and executing {registry_sql_path}...")
        with open(registry_sql_path, "r", encoding="utf-8") as f:
            sql_script = f.read()
        cur.executescript(sql_script)
        print("Field registry seeded successfully!")
    else:
        print(f"Warning: {registry_sql_path} not found. Skipping field registry seeding.")
    
    conn.commit()
    cur.close()
    conn.close()
    print("SQLite database successfully initialized and seeded!")

if __name__ == "__main__":
    main()
