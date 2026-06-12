-- =============================================================================
-- education_data — фактические значения для любого поля из data_catalog
-- Паттерн EAV + JSONB: принимает новые поля без миграции схемы
-- =============================================================================

CREATE TABLE IF NOT EXISTS education_data (
    id                  BIGSERIAL PRIMARY KEY,

    org_id              UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    catalog_field_id    INTEGER NOT NULL REFERENCES data_catalog(id)  ON DELETE RESTRICT,

    period_year         INTEGER NOT NULL,
    period_month        INTEGER CHECK (period_month    BETWEEN 1 AND 12),
    period_quarter      INTEGER CHECK (period_quarter  BETWEEN 1 AND 4),

    value_numeric       NUMERIC(20,4),
    value_text          TEXT,
    value_jsonb         JSONB,

    submission_status   VARCHAR(20)  DEFAULT 'draft',
    source_file         VARCHAR(255),
    imported_from       VARCHAR(50)  DEFAULT 'manual',
    comment             TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    version             INTEGER DEFAULT 1,

    UNIQUE (org_id, catalog_field_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_edu_data_org_period ON education_data (org_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_edu_data_field      ON education_data (catalog_field_id);
CREATE INDEX IF NOT EXISTS idx_edu_data_period     ON education_data (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_edu_data_status     ON education_data (submission_status);
CREATE INDEX IF NOT EXISTS idx_edu_data_jsonb      ON education_data USING GIN (value_jsonb);

ALTER TABLE education_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_education_data ON education_data;
CREATE POLICY rls_education_data ON education_data
    USING (
        current_setting('app.org_id', TRUE) = '' OR
        current_setting('app.org_id', TRUE) IS NULL OR
        org_id::TEXT = current_setting('app.org_id', TRUE)
    );

COMMENT ON TABLE education_data IS
    'Универсальное хранилище фактических данных для любого поля из data_catalog.';
COMMENT ON COLUMN education_data.value_jsonb IS
    'Для структурированных значений: разбивка по специальностям, языкам, формам и т.д.';
