"""Create all base tables from scratch.

Revision ID: 0000
Revises: (none — this is the root migration)
Create Date: 2026-06-17

This migration replaces the deleted edu_monitoring_schema.sql.
On a FRESH server: Alembic runs 0000 → 0001 → 0002, then phase2 SQL files.
On an EXISTING server: Alembic stamp shows 0002 → nothing runs.

Tables created here use IF NOT EXISTS so re-running is safe.
All domain tables are created with FullAuditMixin columns already in place so
0001's idempotency check (SELECT version column) causes it to skip ADD COLUMN blocks.

0001 still creates triggers, RLS policies, and JSONB/status indexes —
we do NOT duplicate those here.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0000"
down_revision = None
branch_labels = None
depends_on = None


# Columns added by FullAuditMixin — created here so 0001 skips them
AUDIT_COLS = [
    ("created_at",        "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
    ("updated_at",        "TIMESTAMPTZ DEFAULT NOW()"),
    ("created_by",        "VARCHAR(36)"),
    ("updated_by",        "VARCHAR(36)"),
    ("version",           "INTEGER NOT NULL DEFAULT 1"),
    ("deleted_at",        "TIMESTAMPTZ"),
    ("deleted_by",        "VARCHAR(36)"),
    ("submission_status", "VARCHAR(20) NOT NULL DEFAULT 'draft'"),
]


def _audit_cols_sql() -> str:
    return ",\n    ".join(f"{col} {defn}" for col, defn in AUDIT_COLS)


def upgrade() -> None:
    conn = op.get_bind()

    # ── Extension ─────────────────────────────────────────────────────────────
    conn.execute(sa.text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))

    # ─────────────────────────────────────────────────────────────────────────
    # 1. REFERENCE TABLES
    # ─────────────────────────────────────────────────────────────────────────

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS org_types (
            id          SERIAL PRIMARY KEY,
            code        VARCHAR(20) UNIQUE NOT NULL,
            name_ru     TEXT NOT NULL,
            description TEXT
        )
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS regions (
            id      SERIAL PRIMARY KEY,
            code    VARCHAR(10) UNIQUE NOT NULL,
            name_ru TEXT NOT NULL,
            type    VARCHAR(20) CHECK (type IN ('oblast', 'city'))
        )
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS localities (
            id        SERIAL PRIMARY KEY,
            region_id INTEGER NOT NULL REFERENCES regions(id),
            name_ru   TEXT NOT NULL,
            type      VARCHAR(30),
            UNIQUE (region_id, name_ru)
        )
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS ownership_forms (
            id      SERIAL PRIMARY KEY,
            code    VARCHAR(20) UNIQUE NOT NULL,
            name_ru TEXT NOT NULL
        )
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS org_kinds (
            id          SERIAL PRIMARY KEY,
            org_type_id INTEGER REFERENCES org_types(id),
            name_ru     TEXT NOT NULL
        )
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS data_sources (
            id      SERIAL PRIMARY KEY,
            code    VARCHAR(50) UNIQUE NOT NULL,
            name_ru TEXT NOT NULL,
            url     TEXT
        )
    """))

    # ─────────────────────────────────────────────────────────────────────────
    # 2. CORE TABLES
    # ─────────────────────────────────────────────────────────────────────────

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS organizations (
            id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            system_account_id   TEXT,
            bin                 VARCHAR(12) UNIQUE,
            name_ru             TEXT NOT NULL,
            org_type_id         INTEGER REFERENCES org_types(id),
            org_kind_id         INTEGER REFERENCES org_kinds(id),
            ownership_form_id   INTEGER REFERENCES ownership_forms(id),
            region_id           INTEGER REFERENCES regions(id),
            locality_id         INTEGER REFERENCES localities(id),
            address_full        TEXT,
            activity_start_date DATE,
            reorganization_date DATE,
            status              VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','reorganized','liquidated')),
            vuz_status          VARCHAR(30),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_org_type_id   ON organizations (org_type_id)"))
    conn.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_org_bin ON organizations (bin) WHERE bin IS NOT NULL"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_org_region_id  ON organizations (region_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_org_status     ON organizations (status)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS api_tokens (
            id           SERIAL PRIMARY KEY,
            token_hash   TEXT UNIQUE NOT NULL,
            org_id       UUID REFERENCES organizations(id),
            name         TEXT,
            scopes       TEXT[],
            is_active    BOOLEAN DEFAULT TRUE,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at   TIMESTAMPTZ,
            last_used_at TIMESTAMPTZ
        )
    """))

    # ─────────────────────────────────────────────────────────────────────────
    # 3. AUDIT LOG
    # ─────────────────────────────────────────────────────────────────────────

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id          BIGSERIAL PRIMARY KEY,
            table_name  TEXT NOT NULL,
            record_id   TEXT NOT NULL,
            action      VARCHAR(10) NOT NULL,
            changed_by  TEXT,
            org_id      TEXT,
            old_data    JSONB,
            new_data    JSONB,
            changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_audit_log_table_name  ON audit_log (table_name)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_audit_log_org_id      ON audit_log (org_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_audit_log_changed_at  ON audit_log (changed_at)"))

    # ─────────────────────────────────────────────────────────────────────────
    # 4. DOMAIN TABLES (with FullAuditMixin columns so 0001 skips ADD COLUMN)
    # ─────────────────────────────────────────────────────────────────────────

    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS contingent_snapshots (
            id                   SERIAL PRIMARY KEY,
            org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            source_id            INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
            snapshot_date        DATE NOT NULL,
            total_count          INTEGER,
            new_enrolled         INTEGER,
            withdrawn            INTEGER,
            bachelor_count       INTEGER,
            master_count         INTEGER,
            phd_count            INTEGER,
            full_time_count      INTEGER,
            distance_count       INTEGER,
            budget_count         INTEGER,
            paid_count           INTEGER,
            by_grade_json        JSONB,
            by_specialty_json    JSONB,
            prize_winners_json   JSONB,
            kz_lang_count        INTEGER,
            ru_lang_count        INTEGER,
            en_lang_count        INTEGER,
            other_lang_count     INTEGER,
            many_children_count  INTEGER,
            low_income_count     INTEGER,
            disabled_count       INTEGER,
            orphan_count         INTEGER,
            oop_count            INTEGER,
            foreign_count        INTEGER,
            privileged_share     NUMERIC(5,2),
            boarding_school_count INTEGER,
            absences_count       INTEGER,
            {_audit_cols_sql()},
            UNIQUE (org_id, snapshot_date)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_contingent_org_date ON contingent_snapshots (org_id, snapshot_date)"))

    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS finance_records (
            id                          SERIAL PRIMARY KEY,
            org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            source_id                   INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
            period_year                 SMALLINT NOT NULL,
            period_month                SMALLINT,
            funding_sources_json        JSONB,
            annual_budget               NUMERIC(18,2),
            state_order_volume          NUMERIC(18,2),
            extra_budget_income         NUMERIC(18,2),
            per_capita_norm             NUMERIC(12,2),
            state_order_start_date      DATE,
            state_order_end_date        DATE,
            state_order_planned_amount  NUMERIC(18,2),
            vouchers_issued             INTEGER,
            payments_to_suppliers       NUMERIC(18,2),
            violations_info             TEXT,
            return_notification_amount  NUMERIC(18,2),
            return_reason               TEXT,
            expenses_utilities          NUMERIC(18,2),
            expenses_payroll            NUMERIC(18,2),
            expenses_antiterror         NUMERIC(18,2),
            expenses_food               NUMERIC(18,2),
            expenses_medical            NUMERIC(18,2),
            expenses_retraining         NUMERIC(18,2),
            expenses_olympiads          NUMERIC(18,2),
            expenses_extra_education    NUMERIC(18,2),
            expenses_special_equipment  NUMERIC(18,2),
            expenses_transport          NUMERIC(18,2),
            expenses_rnd                NUMERIC(18,2),
            expenses_scholarships       NUMERIC(18,2),
            expenses_boarding           NUMERIC(18,2),
            circle_price_per_session    NUMERIC(10,2),
            paid_services_price         NUMERIC(10,2),
            paid_vs_free_ratio          NUMERIC(5,2),
            budget_execution_report_url TEXT,
            payment_orders_count        INTEGER,
            financing_requests_count    INTEGER,
            {_audit_cols_sql()},
            UNIQUE (org_id, period_year, period_month)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_finance_org_year ON finance_records (org_id, period_year)"))

    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS science_activity (
            id                    SERIAL PRIMARY KEY,
            org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            source_id             INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
            period_year           SMALLINT NOT NULL,
            grants_json           JSONB,
            student_projects_json JSONB,
            hirsch_index_avg      NUMERIC(6,2),
            hirsch_index_max      NUMERIC(6,2),
            publications_q1       INTEGER,
            publications_q2       INTEGER,
            publications_q3       INTEGER,
            publications_q4       INTEGER,
            publications_scopus   INTEGER,
            publications_wos      INTEGER,
            {_audit_cols_sql()},
            UNIQUE (org_id, period_year)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_science_org_year ON science_activity (org_id, period_year)"))

    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS graduates_records (
            id                               SERIAL PRIMARY KEY,
            org_id                           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            source_id                        INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
            graduation_year                  SMALLINT NOT NULL,
            graduates_total                  INTEGER,
            to_tippo_count                   INTEGER,
            to_vipo_count                    INTEGER,
            to_top_vipo_count                INTEGER,
            not_enrolled_count               INTEGER,
            final_attestation_avg_score      NUMERIC(5,2),
            final_attestation_pass_pct       NUMERIC(5,2),
            employed_6m_pct                  NUMERIC(5,2),
            employed_12m_pct                 NUMERIC(5,2),
            employed_36m_pct                 NUMERIC(5,2),
            employed_60m_pct                 NUMERIC(5,2),
            avg_salary_by_specialty_json     JSONB,
            achievements_json                JSONB,
            legal_entities_participation_json JSONB,
            taxes_paid_json                  JSONB,
            survey_results_json              JSONB,
            employer_partners_json           JSONB,
            grant_workback_amount            NUMERIC(18,2),
            {_audit_cols_sql()},
            UNIQUE (org_id, graduation_year)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_graduates_org_year ON graduates_records (org_id, graduation_year)"))

    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS educational_process (
            id                           SERIAL PRIMARY KEY,
            org_id                       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            source_id                    INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
            snapshot_date                DATE NOT NULL,
            mandatory_programs_count     INTEGER,
            optional_programs_count      INTEGER,
            international_programs_count INTEGER,
            has_developing_environment   BOOLEAN,
            startup_projects_count       INTEGER,
            additional_programs_json     JSONB,
            circles_sections_json        JSONB,
            olympiad_participation_json  JSONB,
            parent_survey_results_json   JSONB,
            academic_mobility_json       JSONB,
            academic_performance_json    JSONB,
            practice_partners_json       JSONB,
            {_audit_cols_sql()},
            UNIQUE (org_id, snapshot_date)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_education_org_date ON educational_process (org_id, snapshot_date)"))

    # ─────────────────────────────────────────────────────────────────────────
    # 5. LEGACY STUB TABLES (iterated by 0001 — need version col so 0001 skips)
    # ─────────────────────────────────────────────────────────────────────────

    for stub_table in (
        "staff_snapshots",
        "infrastructure_records",
        "equipment_records",
        "digitalization_records",
        "medical_records",
    ):
        conn.execute(sa.text(f"""
            CREATE TABLE IF NOT EXISTS {stub_table} (
                id      SERIAL PRIMARY KEY,
                org_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                {_audit_cols_sql()}
            )
        """))

    # ─────────────────────────────────────────────────────────────────────────
    # 6. AI / ANALYTICS TABLES
    # ─────────────────────────────────────────────────────────────────────────

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS anomaly_reports (
            id                  SERIAL PRIMARY KEY,
            sphere              VARCHAR(50) NOT NULL,
            region_id           INTEGER,
            year                INTEGER NOT NULL,
            severity            VARCHAR(20) NOT NULL DEFAULT 'warning',
            metric_name         VARCHAR(200) NOT NULL,
            metric_label        VARCHAR(200),
            raw_value           NUMERIC,
            expected_value      NUMERIC,
            deviation_pct       NUMERIC,
            z_score             NUMERIC,
            trend_json          JSONB,
            ai_explanation_json JSONB,
            status              VARCHAR(20) NOT NULL DEFAULT 'new',
            scan_run_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_anomaly_sphere     ON anomaly_reports (sphere)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_anomaly_region_id  ON anomaly_reports (region_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_anomaly_year       ON anomaly_reports (year)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_anomaly_severity   ON anomaly_reports (severity)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_anomaly_status     ON anomaly_reports (status)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_anomaly_created_at ON anomaly_reports (created_at)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS evaluation_reports (
            id            SERIAL PRIMARY KEY,
            requested_by  UUID,
            org_id        UUID REFERENCES organizations(id) ON DELETE SET NULL,
            region_id     INTEGER REFERENCES regions(id),
            org_type_id   INTEGER REFERENCES org_types(id),
            period_year   INTEGER NOT NULL,
            focus         TEXT,
            status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','generating','done','failed')),
            slides_json   JSONB,
            analytics_json JSONB,
            error_message  TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_eval_status ON evaluation_reports (status)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_eval_requested_by ON evaluation_reports (requested_by)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS ai_insight_history (
            id           SERIAL PRIMARY KEY,
            requested_by UUID,
            request_json JSONB,
            response_json JSONB,
            model_used   VARCHAR(100),
            duration_ms  INTEGER,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_insight_requested_by ON ai_insight_history (requested_by)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_insight_created_at   ON ai_insight_history (created_at)"))

    # ─────────────────────────────────────────────────────────────────────────
    # 7. SEED REFERENCE DATA
    # ─────────────────────────────────────────────────────────────────────────

    conn.execute(sa.text("""
        INSERT INTO org_types (id, code, name_ru, description) VALUES
            (1, 'ДО',    'Дошкольное образование',                     'Детские сады, мини-центры, ясли'),
            (2, 'ДопО',  'Дополнительное образование',                 'Спортшколы, музыкальные, художественные школы'),
            (3, 'СО',    'Среднее образование',                        'Школы, лицеи, гимназии, интернаты, лагеря'),
            (4, 'ТиППО', 'Техническое и профессиональное образование', 'Колледжи, профлицеи, ПТШ'),
            (5, 'ВиПО',  'Высшее и послевузовское образование',        'Университеты, академии, институты'),
            (6, 'Общ-е', 'Общежития',                                  'Общежития при ТиППО и ВиПО'),
            (7, 'ГОНС',  'ГОНС Келешек',                               'Государственная образовательная накопительная система')
        ON CONFLICT (id) DO NOTHING
    """))

    conn.execute(sa.text("""
        INSERT INTO ownership_forms (id, code, name_ru) VALUES
            (1, 'state',         'Государственная'),
            (2, 'private',       'Частная'),
            (3, 'ppp',           'Государственно-частное партнёрство'),
            (4, 'municipal',     'Коммунальная'),
            (5, 'national',      'Национальная'),
            (6, 'international', 'Международная')
        ON CONFLICT (id) DO NOTHING
    """))

    conn.execute(sa.text("""
        INSERT INTO regions (id, code, name_ru, type) VALUES
            ( 1, 'AKM', 'Акмолинская область',             'oblast'),
            ( 2, 'AKT', 'Актюбинская область',             'oblast'),
            ( 3, 'ALM', 'Алматинская область',             'oblast'),
            ( 4, 'ATY', 'Атырауская область',              'oblast'),
            ( 5, 'VKO', 'Восточно-Казахстанская область',  'oblast'),
            ( 6, 'ZHM', 'Жамбылская область',              'oblast'),
            ( 7, 'ZHT', 'Жетісу область',                  'oblast'),
            ( 8, 'ZKO', 'Западно-Казахстанская область',   'oblast'),
            ( 9, 'KAR', 'Карагандинская область',          'oblast'),
            (10, 'KOS', 'Костанайская область',            'oblast'),
            (11, 'KZO', 'Кызылординская область',          'oblast'),
            (12, 'MAN', 'Мангистауская область',           'oblast'),
            (13, 'PAV', 'Павлодарская область',            'oblast'),
            (14, 'SKO', 'Северо-Казахстанская область',    'oblast'),
            (15, 'TRK', 'Туркестанская область',           'oblast'),
            (16, 'ULT', 'Ұлытау область',                  'oblast'),
            (17, 'ALA', 'г. Алматы',                       'city'),
            (18, 'AST', 'г. Астана',                       'city'),
            (19, 'SHY', 'г. Шымкент',                      'city')
        ON CONFLICT (id) DO NOTHING
    """))

    conn.execute(sa.text("""
        INSERT INTO data_sources (id, code, name_ru, url) VALUES
            ( 1, 'НОБД',       'Национальная образовательная база данных',      'https://nobd.edu.kz'),
            ( 2, 'ЕПВО',       'Единый реестр организаций высшего образования', 'https://epvo.kz'),
            ( 3, 'eGov',       'Электронное правительство',                     'https://egov.kz'),
            ( 4, 'elicense',   'Лицензирование',                                'https://elicense.kz'),
            ( 5, 'АРРФР',      'Агентство по регулированию финрынка',           NULL),
            ( 6, 'АО ФЦ ЕРД',  'АО Финансовый центр ЕРД',                      NULL),
            ( 7, 'КОПД',       'Комитет охраны прав детей',                     NULL),
            ( 8, 'МТСЗН',      'Министерство труда и соцзащиты населения',      NULL),
            ( 9, 'Кунделик',   'ИС Кунделик',                                   'https://kundelik.kz'),
            (10, 'Студом',     'ИС Студом',                                     NULL),
            (11, 'ГБДФЛ',      'ГБД Физических лиц',                            NULL),
            (12, 'ЕНПФ',       'Единый накопительный пенсионный фонд',          NULL),
            (13, 'орг_данные', 'Данные самой организации',                      NULL)
        ON CONFLICT (id) DO NOTHING
    """))


def downgrade() -> None:
    conn = op.get_bind()
    for t in (
        "ai_insight_history", "evaluation_reports", "anomaly_reports",
        "staff_snapshots", "infrastructure_records", "equipment_records",
        "digitalization_records", "medical_records",
        "educational_process", "graduates_records", "science_activity",
        "finance_records", "contingent_snapshots",
        "audit_log", "api_tokens", "organizations",
        "data_sources", "org_kinds", "ownership_forms",
        "localities", "regions", "org_types",
    ):
        conn.execute(sa.text(f"DROP TABLE IF EXISTS {t} CASCADE"))
