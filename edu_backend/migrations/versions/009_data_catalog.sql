-- =============================================================================
-- data_catalog — справочник всех 2977 полей из каталога данных
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_catalog (
    id              SERIAL PRIMARY KEY,

    code            VARCHAR(20)  NOT NULL,
    education_level VARCHAR(20)  NOT NULL,
    section         VARCHAR(255) NOT NULL,
    section_slug    VARCHAR(50)  NOT NULL,

    field_name      TEXT         NOT NULL,
    field_slug      VARCHAR(255) NOT NULL,
    description     TEXT,

    source          VARCHAR(255),
    frequency       VARCHAR(50),
    data_type_code  VARCHAR(20),

    sort_order      INTEGER  DEFAULT 0,
    is_active       BOOLEAN  DEFAULT TRUE,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (education_level, section_slug, field_slug)
);

CREATE INDEX IF NOT EXISTS idx_catalog_level   ON data_catalog (education_level);
CREATE INDEX IF NOT EXISTS idx_catalog_section ON data_catalog (education_level, section_slug);
CREATE INDEX IF NOT EXISTS idx_catalog_source  ON data_catalog (source);
CREATE INDEX IF NOT EXISTS idx_catalog_active  ON data_catalog (is_active) WHERE is_active = TRUE;

COMMENT ON TABLE data_catalog IS
    'Справочник всех полей из каталога данных. 2977+ полей.';
