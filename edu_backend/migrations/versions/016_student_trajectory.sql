-- 016_student_trajectory.sql
-- Траектория учащегося: данные уровня студента
-- Источники: НЦТ (реестр + ЕНТ), АИС вузов (GPA), МТСЗН (занятость), КГД/ГЦВП (зарплата)

-- ── Новые источники данных ────────────────────────────────────────────────────
INSERT INTO data_sources (code, name_ru) VALUES
  ('НЦТ',  'Национальный центр тестирования'),
  ('МТСЗН','Министерство труда и социальной защиты населения'),
  ('КГД',  'Комитет государственных доходов'),
  ('ГЦВП', 'Государственный центр по выплате пенсий')
ON CONFLICT (code) DO NOTHING;

-- ── 1. Реестр студентов (НЦТ) ────────────────────────────────────────────────
CREATE TABLE student_registry (
    id                   BIGSERIAL    PRIMARY KEY,
    iin                  VARCHAR(12)  NOT NULL,
    org_id               UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_id            INTEGER      REFERENCES data_sources(id) ON DELETE SET NULL,

    education_level      VARCHAR(20)  NOT NULL,   -- tippo / bachelor / master / phd
    specialty_code       VARCHAR(50),
    specialty_name       TEXT,
    graduation_year      SMALLINT     NOT NULL,
    enrollment_year      SMALLINT,
    ent_score            SMALLINT     CHECK (ent_score BETWEEN 0 AND 140),
    is_grant             BOOLEAN,
    tuition_cost_annual  NUMERIC(18,2),
    total_budget_spent   NUMERIC(18,2),

    -- FullAuditMixin
    version      INTEGER      NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW(),
    created_by   VARCHAR(36),
    updated_by   VARCHAR(36),
    deleted_at   TIMESTAMPTZ,
    deleted_by   VARCHAR(36),

    CONSTRAINT uq_student_iin UNIQUE (iin)
);

CREATE INDEX ix_student_registry_org_year ON student_registry (org_id, graduation_year);
CREATE INDEX ix_student_registry_active   ON student_registry (org_id, graduation_year) WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at_student_registry
    BEFORE UPDATE ON student_registry
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE  student_registry            IS 'Реестр студентов — базовые данные (НЦТ)';
COMMENT ON COLUMN student_registry.iin        IS 'ИИН физического лица (12 цифр)';
COMMENT ON COLUMN student_registry.ent_score  IS 'Балл ЕНТ (0–140)';
COMMENT ON COLUMN student_registry.is_grant   IS 'TRUE = грант, FALSE = платное';

-- ── 2. Успеваемость по семестрам (АИС вузов/ТиПО) ────────────────────────────
CREATE TABLE student_academic (
    id              BIGSERIAL    PRIMARY KEY,
    iin             VARCHAR(12)  NOT NULL REFERENCES student_registry(iin) ON DELETE CASCADE,
    source_id       INTEGER      REFERENCES data_sources(id) ON DELETE SET NULL,
    academic_year   SMALLINT     NOT NULL,
    semester_number SMALLINT     NOT NULL CHECK (semester_number BETWEEN 1 AND 12),
    gpa             NUMERIC(3,2) CHECK (gpa BETWEEN 2.00 AND 5.00),
    credits_earned  SMALLINT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_student_academic UNIQUE (iin, academic_year, semester_number)
);

CREATE INDEX ix_student_academic_iin ON student_academic (iin);

COMMENT ON TABLE student_academic IS 'GPA по семестрам — из АИС вузов и ТиПО';

-- ── 3. Занятость (МТСЗН — реестр ОСМС/ЕНСС) ─────────────────────────────────
CREATE TABLE student_employment (
    id                BIGSERIAL    PRIMARY KEY,
    iin               VARCHAR(12)  NOT NULL REFERENCES student_registry(iin) ON DELETE CASCADE,
    source_id         INTEGER      REFERENCES data_sources(id) ON DELETE SET NULL,
    period_year       SMALLINT     NOT NULL,
    employment_status VARCHAR(20)  NOT NULL DEFAULT 'unknown',  -- employed/unemployed/ip/unknown
    employment_date   DATE,
    employer_name     TEXT,
    employer_bin      VARCHAR(12),
    employer_oked     VARCHAR(10),
    region_id         INTEGER      REFERENCES regions(id) ON DELETE SET NULL,
    specialty_match   BOOLEAN,
    months_to_employ  SMALLINT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_student_employment UNIQUE (iin, period_year)
);

CREATE INDEX ix_student_employment_iin ON student_employment (iin);

COMMENT ON TABLE  student_employment                  IS 'Данные о занятости выпускников (МТСЗН)';
COMMENT ON COLUMN student_employment.specialty_match  IS 'Трудоустроен по специальности';
COMMENT ON COLUMN student_employment.months_to_employ IS 'Месяцев от выпуска до трудоустройства';

-- ── 4. Зарплата и налоги (КГД + ГЦВП) ────────────────────────────────────────
CREATE TABLE student_salary (
    id              BIGSERIAL    PRIMARY KEY,
    iin             VARCHAR(12)  NOT NULL REFERENCES student_registry(iin) ON DELETE CASCADE,
    source_id       INTEGER      REFERENCES data_sources(id) ON DELETE SET NULL,
    period_year     SMALLINT     NOT NULL,
    period_quarter  SMALLINT     NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),
    salary_amount   NUMERIC(18,2),
    ipn_amount      NUMERIC(18,2),
    pension_amount  NUMERIC(18,2),
    income_source   VARCHAR(20)  DEFAULT 'hire',   -- hire/entrepreneurship/other
    employer_oked   VARCHAR(10),
    source_type     VARCHAR(10)  NOT NULL DEFAULT 'kgd',  -- kgd/gcvp

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_student_salary UNIQUE (iin, period_year, period_quarter, source_type)
);

CREATE INDEX ix_student_salary_iin ON student_salary (iin);

COMMENT ON TABLE  student_salary              IS 'Зарплата и налоги (КГД) + пенсионные отчисления (ГЦВП)';
COMMENT ON COLUMN student_salary.ipn_amount   IS 'Индивидуальный подоходный налог (тг)';
COMMENT ON COLUMN student_salary.pension_amount IS 'Отчисления ЕНПФ (тг)';
COMMENT ON COLUMN student_salary.source_type  IS 'kgd = КГД, gcvp = ГЦВП';
