-- 008_unified_catalog_mapping.sql
-- Linking specialized modules to the central Data Catalog

BEGIN;

-- 1. Extend Coefficient Definitions with Data Catalog mapping
ALTER TABLE coefficient_definitions 
ADD COLUMN IF NOT EXISTS numerator_catalog_id INTEGER REFERENCES data_catalog(id) ON DELETE SET NULL;

ALTER TABLE coefficient_definitions 
ADD COLUMN IF NOT EXISTS denominator_catalog_id INTEGER REFERENCES data_catalog(id) ON DELETE SET NULL;

COMMENT ON COLUMN coefficient_definitions.numerator_catalog_id IS 'ID поля из data_catalog для автоматического получения числителя';
COMMENT ON COLUMN coefficient_definitions.denominator_catalog_id IS 'ID поля из data_catalog для автоматического получения знаменателя';

-- 2. Extend College Assessment with indicator mapping (metadata)
-- We add a column to store which catalog field each score column corresponds to
CREATE TABLE IF NOT EXISTS college_assessment_field_mapping (
    id                SERIAL PRIMARY KEY,
    ca_column         VARCHAR(100) NOT NULL, -- e.g., 'repair_capital_done'
    catalog_field_id  INTEGER NOT NULL REFERENCES data_catalog(id) ON DELETE CASCADE,
    UNIQUE(ca_column, catalog_field_id)
);

COMMENT ON TABLE college_assessment_field_mapping IS 'Маппинг колонок таблицы оценки колледжей на центральный каталог данных';

-- 3. Extend School Rating with indicator mapping
CREATE TABLE IF NOT EXISTS school_rating_field_mapping (
    id                SERIAL PRIMARY KEY,
    raw_data_key      VARCHAR(100) NOT NULL, -- key in raw_data JSONB
    catalog_field_id  INTEGER NOT NULL REFERENCES data_catalog(id) ON DELETE CASCADE,
    UNIQUE(raw_data_key, catalog_field_id)
);

COMMENT ON TABLE school_rating_field_mapping IS 'Маппинг ключей JSONB рейтинга школ на центральный каталог данных';

COMMIT;
