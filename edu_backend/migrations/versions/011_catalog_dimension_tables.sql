-- ═══════════════════════════════════════════════════════════════════════════════
-- 011_catalog_dimension_tables.sql
--
-- Нормализованные таблицы для размерных полей каталога.
-- Заменяют необходимость хранить 1500+ полей в одной таблице.
--
-- Три новых таблицы:
--   1. enrollment_dim       — ВиПО: поступившие/обучающиеся по степени × направлению × языку
--   2. student_contingent   — ДО/ДопО/СО/ТиППО/ГОНС: контингент по ступени × категории × языку
--   3. staff_by_category    — все уровни: педагоги по типу × квалификации × языку
--
-- Плюс таблица-маппинг:
--   4. catalog_field_mapping — связь каждого поля data_catalog с местом хранения в БД
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. enrollment_dim
--    Для уровня ВиПО (vipo).
--    Одна строка = одна комбинация (степень, направление, подспециальность, язык,
--                                   форма финансирования, форма обучения, год обучения)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollment_dim (
    id              BIGSERIAL PRIMARY KEY,
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_year     INTEGER NOT NULL,
    period_month    INTEGER CHECK (period_month BETWEEN 1 AND 12),

    -- Измерения
    degree_type     VARCHAR(30) NOT NULL,
    -- Значения: 'bachelor' | 'master_profile_fast' | 'master' | 'phd'
    --           | 'residency' | 'internship' | 'total'

    direction_code  VARCHAR(60),
    -- Значения: 'healthcare_medicine' | 'pedagogy' | 'arts_humanities'
    --   | 'social_journalism' | 'business_law' | 'science_math'
    --   | 'ict' | 'engineering' | 'agriculture' | 'veterinary'
    --   | 'services' | 'national_security' | 'total' | NULL

    sub_direction   VARCHAR(100),
    -- Для здравоохранения: 'nursing' | 'pharmacy' | 'general_medicine'
    --   | 'dentistry' | 'pediatrics' | 'public_health' | 'preventive_medicine'
    --   | 'health_management' | 'biomedicine' | NULL

    language        VARCHAR(10) NOT NULL DEFAULT 'total',
    -- Значения: 'kz' | 'ru' | 'en' | 'other' | 'total'

    funding_type    VARCHAR(20) NOT NULL DEFAULT 'total',
    -- Значения: 'budget' | 'paid' | 'total'

    study_form      VARCHAR(20) NOT NULL DEFAULT 'total',
    -- Значения: 'full_time' | 'distance' | 'total'

    study_year      INTEGER CHECK (study_year BETWEEN 1 AND 7),
    -- 1-6 (год обучения), NULL = итого

    -- Показатели
    enrolled_count          INTEGER,        -- поступившие
    total_studying          INTEGER,        -- обучающиеся
    graduated_count         INTEGER,        -- выпускники
    expelled_count          INTEGER,        -- отчисленные
    academic_leave_count    INTEGER,        -- академический отпуск
    transferred_out_count   INTEGER,        -- переведены в другие вузы
    dormitory_applied       INTEGER,        -- подали заявки на общежитие
    dormitory_granted       INTEGER,        -- заявки удовлетворены
    dormitory_denied        INTEGER,        -- заявки отклонены

    -- Workflow
    submission_status   VARCHAR(20) NOT NULL DEFAULT 'draft',
    source_file         VARCHAR(255),
    imported_from       VARCHAR(50) DEFAULT 'manual',
    comment             TEXT,

    -- Аудит
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    deleted_at  TIMESTAMPTZ,

    UNIQUE (org_id, period_year, period_month,
            degree_type, direction_code, sub_direction,
            language, funding_type, study_form, study_year)
);

CREATE INDEX IF NOT EXISTS idx_enroll_dim_org_period
    ON enrollment_dim (org_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_enroll_dim_degree
    ON enrollment_dim (degree_type, direction_code);
CREATE INDEX IF NOT EXISTS idx_enroll_dim_status
    ON enrollment_dim (submission_status);

ALTER TABLE enrollment_dim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_enrollment_dim ON enrollment_dim;
CREATE POLICY rls_enrollment_dim ON enrollment_dim
    USING (
        current_setting('app.org_id', TRUE) IS NULL OR
        current_setting('app.org_id', TRUE) = '' OR
        org_id::TEXT = current_setting('app.org_id', TRUE)
    );

COMMENT ON TABLE enrollment_dim IS
    'ВиПО: численность студентов в разрезе степень × направление × язык × финансирование. '
    'Покрывает ~1534 поля каталога раздела "Контингент" уровня vipo.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. student_contingent
--    Для уровней: ДО, ДопО, СО, ТиППО, ГОНС, Общежития.
--    Одна строка = одна комбинация (уровень, ступень, категория, язык, форма)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_contingent (
    id              BIGSERIAL PRIMARY KEY,
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    education_level VARCHAR(20) NOT NULL,
    -- 'do' | 'dopo' | 'so' | 'tippo' | 'gons' | 'obsh'

    period_year     INTEGER NOT NULL,
    period_month    INTEGER CHECK (period_month BETWEEN 1 AND 12),

    -- Измерения
    grade_range     VARCHAR(30),
    -- СО: '1-4' | '5-9' | '10-11' | 'total'
    -- ДО: 'early' (до 3 лет) | 'preschool' (3-6 лет) | 'total'
    -- ТиППО: '1' | '2' | '3' | '4' | 'total'

    category        VARCHAR(50) NOT NULL DEFAULT 'total',
    -- 'total' | 'oop' | 'disabled' | 'inclusive' | 'low_income'
    -- | 'orphan' | 'guardian' | 'home_study' | 'foreign'
    -- | 'privileged' | 'many_children' | 'boarding' | 'camp'

    language        VARCHAR(10) NOT NULL DEFAULT 'total',
    -- 'kz' | 'ru' | 'en' | 'other' | 'total'

    funding_type    VARCHAR(20) NOT NULL DEFAULT 'total',
    -- 'budget' | 'paid' | 'voucher' | 'total'

    study_form      VARCHAR(20) NOT NULL DEFAULT 'total',
    -- 'full_time' | 'distance' | 'evening' | 'total'

    -- Показатели
    total_count         INTEGER,        -- общая численность
    new_enrolled        INTEGER,        -- вновь принятые
    expelled            INTEGER,        -- отчисленные
    absences_count      INTEGER,        -- пропуски
    privileged_share    NUMERIC(5,2),   -- доля льготников %
    queue_count         INTEGER,        -- очередь (ДО)

    -- Workflow
    submission_status   VARCHAR(20) NOT NULL DEFAULT 'draft',
    source_file         VARCHAR(255),
    imported_from       VARCHAR(50) DEFAULT 'manual',
    comment             TEXT,

    -- Аудит
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    deleted_at  TIMESTAMPTZ,

    UNIQUE (org_id, education_level, period_year, period_month,
            grade_range, category, language, funding_type, study_form)
);

CREATE INDEX IF NOT EXISTS idx_student_cont_org_level
    ON student_contingent (org_id, education_level, period_year);
CREATE INDEX IF NOT EXISTS idx_student_cont_category
    ON student_contingent (education_level, category, period_year);
CREATE INDEX IF NOT EXISTS idx_student_cont_status
    ON student_contingent (submission_status);

ALTER TABLE student_contingent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_student_contingent ON student_contingent;
CREATE POLICY rls_student_contingent ON student_contingent
    USING (
        current_setting('app.org_id', TRUE) IS NULL OR
        current_setting('app.org_id', TRUE) = '' OR
        org_id::TEXT = current_setting('app.org_id', TRUE)
    );

COMMENT ON TABLE student_contingent IS
    'ДО/ДопО/СО/ТиППО/ГОНС: численность обучающихся по ступени × категории × языку. '
    'Покрывает размерные поля раздела "Контингент" для всех уровней кроме vipo.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. staff_by_category
--    Для всех уровней образования.
--    Одна строка = одна комбинация (уровень, тип педагога, квалификация, язык)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_by_category (
    id              BIGSERIAL PRIMARY KEY,
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    education_level VARCHAR(20) NOT NULL,
    period_year     INTEGER NOT NULL,
    period_month    INTEGER CHECK (period_month BETWEEN 1 AND 12),

    -- Измерения
    staff_category  VARCHAR(60) NOT NULL,
    -- 'educator' | 'teacher' | 'trainee' | 'moderator' | 'expert'
    -- | 'researcher' | 'master_teacher' | 'psychologist'
    -- | 'special_educator' | 'defectologist' | 'speech_therapist'
    -- | 'support' | 'admin' | 'production' | 'total'

    qualification_level VARCHAR(30) NOT NULL DEFAULT 'total',
    -- 'highest' | 'first' | 'second' | 'none'
    -- | 'candidate' | 'doctor' | 'total'

    language        VARCHAR(10) NOT NULL DEFAULT 'total',
    -- 'kz' | 'ru' | 'en' | 'other' | 'total'

    employment_type VARCHAR(20) NOT NULL DEFAULT 'total',
    -- 'full_time' | 'part_time' | 'external' | 'total'

    -- Показатели
    count               INTEGER,        -- численность
    trained_count       INTEGER,        -- прошли повышение квалификации
    certified_count     INTEGER,        -- прошли аттестацию
    competition_count   INTEGER,        -- участвуют в конкурсах
    hired_period        INTEGER,        -- принятые за период
    dismissed_period    INTEGER,        -- уволенные за период
    avg_experience_years NUMERIC(4,1),  -- средний стаж
    avg_workload_hours  NUMERIC(5,1),   -- средняя нагрузка (часов)

    -- Workflow
    submission_status   VARCHAR(20) NOT NULL DEFAULT 'draft',
    source_file         VARCHAR(255),
    imported_from       VARCHAR(50) DEFAULT 'manual',
    comment             TEXT,

    -- Аудит
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    deleted_at  TIMESTAMPTZ,

    UNIQUE (org_id, education_level, period_year, period_month,
            staff_category, qualification_level, language, employment_type)
);

CREATE INDEX IF NOT EXISTS idx_staff_cat_org_level
    ON staff_by_category (org_id, education_level, period_year);
CREATE INDEX IF NOT EXISTS idx_staff_cat_category
    ON staff_by_category (education_level, staff_category, period_year);
CREATE INDEX IF NOT EXISTS idx_staff_cat_status
    ON staff_by_category (submission_status);

ALTER TABLE staff_by_category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_staff_by_category ON staff_by_category;
CREATE POLICY rls_staff_by_category ON staff_by_category
    USING (
        current_setting('app.org_id', TRUE) IS NULL OR
        current_setting('app.org_id', TRUE) = '' OR
        org_id::TEXT = current_setting('app.org_id', TRUE)
    );

COMMENT ON TABLE staff_by_category IS
    'Все уровни: численность педагогического состава по типу × квалификации × языку. '
    'Покрывает 218 размерных полей раздела "Персонал" каталога.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. catalog_field_mapping
--    Явная связь каждого поля data_catalog с местом хранения в БД.
--    storage_type = 'column'    → конкретная колонка в db_table
--    storage_type = 'dim_table' → нормализованная таблица, dim_filters задаёт фильтр
--    storage_type = 'pending'   → ещё не реализовано
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_field_mapping (
    catalog_field_id    INTEGER PRIMARY KEY REFERENCES data_catalog(id) ON DELETE CASCADE,

    storage_type        VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'column' | 'dim_table' | 'pending'

    db_table            VARCHAR(100),
    -- Для 'column': 'contingent_snapshots', 'finance_records', ...
    -- Для 'dim_table': 'enrollment_dim', 'student_contingent', 'staff_by_category'

    db_column           VARCHAR(100),
    -- Только для storage_type='column': имя колонки

    dim_filters         JSONB,
    -- Только для storage_type='dim_table':
    -- Фильтры для SELECT которые дадут именно это поле каталога.
    -- Пример: {"degree_type": "bachelor", "language": "kz", "direction_code": null}

    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cfm_storage_type
    ON catalog_field_mapping (storage_type);
CREATE INDEX IF NOT EXISTS idx_cfm_db_table
    ON catalog_field_mapping (db_table);

COMMENT ON TABLE catalog_field_mapping IS
    'Маппинг каждого поля data_catalog на конкретное место хранения в БД. '
    'storage_type=column: обычная колонка. '
    'storage_type=dim_table: нормализованная таблица с фильтром dim_filters. '
    'storage_type=pending: поле каталога ещё не реализовано в БД.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Начальный маппинг: скалярные поля contingent_snapshots → data_catalog
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO catalog_field_mapping (catalog_field_id, storage_type, db_table, db_column, notes)
SELECT dc.id, 'column', 'contingent_snapshots',
    CASE dc.field_slug
        WHEN 'численность_воспитанников_обучающихся_студентов' THEN 'total_count'
        WHEN '1численность_воспитанников_обучающихся_студентов' THEN 'total_count'
        WHEN 'численность_воспитанников_обучающихся_студентов_вновь_принятых' THEN 'new_enrolled'
        WHEN 'численность_отчисленных' THEN 'withdrawn'
        WHEN 'количество_пропусков' THEN 'absences_count'
        WHEN 'доля_воспитанников_обучающихся_студентов_льготных_категорий' THEN 'privileged_share'
        WHEN 'численность_воспитанников_обучающихся_студентов_иностранцев' THEN 'foreign_count'
    END AS db_column,
    'Скалярный итог из contingent_snapshots' AS notes
FROM data_catalog dc
WHERE dc.section_slug = 'contingent'
  AND dc.field_slug IN (
    'численность_воспитанников_обучающихся_студентов',
    '1численность_воспитанников_обучающихся_студентов',
    'численность_воспитанников_обучающихся_студентов_вновь_принятых',
    'численность_отчисленных',
    'количество_пропусков',
    'доля_воспитанников_обучающихся_студентов_льготных_категорий',
    'численность_воспитанников_обучающихся_студентов_иностранцев'
  )
ON CONFLICT (catalog_field_id) DO NOTHING;

-- Размерные поля contingent → enrollment_dim (vipo) и student_contingent (остальные)
INSERT INTO catalog_field_mapping (catalog_field_id, storage_type, db_table, notes)
SELECT dc.id,
    'dim_table',
    CASE WHEN dc.education_level = 'vipo' THEN 'enrollment_dim'
         ELSE 'student_contingent' END,
    'Размерное поле — фильтры задаются отдельно через dim_filters'
FROM data_catalog dc
WHERE dc.section_slug = 'contingent'
  AND dc.field_slug NOT IN (
    'численность_воспитанников_обучающихся_студентов',
    '1численность_воспитанников_обучающихся_студентов',
    'численность_воспитанников_обучающихся_студентов_вновь_принятых',
    'численность_отчисленных',
    'количество_пропусков',
    'доля_воспитанников_обучающихся_студентов_льготных_категорий',
    'численность_воспитанников_обучающихся_студентов_иностранцев'
  )
ON CONFLICT (catalog_field_id) DO NOTHING;

-- Размерные поля staff → staff_by_category
INSERT INTO catalog_field_mapping (catalog_field_id, storage_type, db_table, notes)
SELECT dc.id, 'dim_table', 'staff_by_category',
    'Размерное поле персонала'
FROM data_catalog dc
WHERE dc.section_slug = 'staff'
ON CONFLICT (catalog_field_id) DO NOTHING;

-- Скалярные поля finance → finance_records
INSERT INTO catalog_field_mapping (catalog_field_id, storage_type, db_table, notes)
SELECT dc.id, 'column', 'finance_records',
    'Финансовое поле — колонка уточняется при импорте'
FROM data_catalog dc
WHERE dc.section_slug = 'finance'
ON CONFLICT (catalog_field_id) DO NOTHING;

-- Остальные разделы — pending (будут маппироваться по мере реализации)
INSERT INTO catalog_field_mapping (catalog_field_id, storage_type, notes)
SELECT dc.id, 'pending', 'Не реализовано'
FROM data_catalog dc
WHERE dc.id NOT IN (SELECT catalog_field_id FROM catalog_field_mapping)
ON CONFLICT (catalog_field_id) DO NOTHING;
