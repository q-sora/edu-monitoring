-- Migration 013: College Assessment tables for ТиППО effectiveness evaluation
-- АО «Финансовый центр» methodology

BEGIN;

-- ── Таблица данных уровня колледжа ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS college_assessment (
    id                  BIGSERIAL PRIMARY KEY,

    org_id              UUID REFERENCES organizations(id) ON DELETE SET NULL,
    college_id_source   INTEGER,
    region              VARCHAR(100),
    district            VARCHAR(100),
    college_name        TEXT NOT NULL,
    ownership_form      VARCHAR(100),
    location_type       VARCHAR(50),

    period_year         INTEGER NOT NULL,
    source_file         VARCHAR(255),
    imported_at         TIMESTAMPTZ DEFAULT NOW(),
    imported_by         UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Инфраструктура / ремонт
    repair_current_done   BOOLEAN,
    repair_not_required   BOOLEAN,
    repair_capital_done   BOOLEAN,
    repair_capital_needed BOOLEAN,
    repair_current_needed BOOLEAN,
    score_repair          NUMERIC(5,2),

    -- Загрузка
    capacity_design   INTEGER,
    contingent_actual INTEGER,
    capacity_pct      NUMERIC(6,2),
    score_capacity    NUMERIC(5,2),

    -- Аттестация
    attestation_result VARCHAR(50),
    score_attestation  NUMERIC(5,2),

    -- Спорт и общежитие
    has_sports_facility BOOLEAN,
    score_sports        NUMERIC(5,2),
    has_dormitory       BOOLEAN,
    score_dormitory     NUMERIC(5,2),

    -- Библиотека
    library_readers_count INTEGER,
    library_readers_pct   NUMERIC(6,2),
    score_library         NUMERIC(5,2),

    -- Мини-предприятия
    mini_enterprise_count        INTEGER,
    score_mini_enterprise        NUMERIC(5,2),
    mini_enterprise_income       NUMERIC(15,2),
    score_mini_enterprise_income NUMERIC(5,2),

    -- Спонсоры
    sponsor_funds  NUMERIC(15,2),
    score_sponsors NUMERIC(5,2),

    -- Методическое объединение
    has_methodical_union   BOOLEAN,
    score_methodical_union NUMERIC(5,2),

    -- Педагоги — квалификация
    teachers_master_count   INTEGER,
    teachers_master_pct     NUMERIC(6,2),
    score_teachers_master   NUMERIC(5,2),
    teachers_science_count  INTEGER,
    teachers_science_pct    NUMERIC(6,2),
    score_teachers_science  NUMERIC(5,2),
    teachers_total          INTEGER,
    talap_trainers_count    INTEGER,
    score_talap_trainers    NUMERIC(5,2),
    best_teacher_winners    INTEGER,
    score_best_teacher      NUMERIC(5,2),

    -- Шефство предприятий
    enterprise_patronage_count INTEGER,
    score_patronage            NUMERIC(5,2),

    -- Итог
    total_score NUMERIC(6,2),

    UNIQUE (college_name, region, period_year)
);

CREATE INDEX IF NOT EXISTS idx_ca_region ON college_assessment (region);
CREATE INDEX IF NOT EXISTS idx_ca_year   ON college_assessment (period_year);
CREATE INDEX IF NOT EXISTS idx_ca_org    ON college_assessment (org_id);
CREATE INDEX IF NOT EXISTS idx_ca_score  ON college_assessment (total_score DESC);

-- ── Таблица данных уровня специальности ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS college_assessment_specialty (
    id            BIGSERIAL PRIMARY KEY,

    assessment_id BIGINT NOT NULL REFERENCES college_assessment(id) ON DELETE CASCADE,

    specialty_raw  TEXT NOT NULL,
    specialty_code VARCHAR(20),
    specialty_name TEXT,

    -- Лаборатории
    labs_total        INTEGER,
    labs_equipped     INTEGER,
    labs_equipped_pct NUMERIC(6,2),
    score_labs        NUMERIC(5,2),

    -- Жас Маман
    zhas_maman_participation VARCHAR(100),
    score_zhas_maman         NUMERIC(5,2),

    -- Педагоги спецдисциплин
    spec_teachers_total       INTEGER,
    spec_teachers_master      INTEGER,
    spec_teachers_master_pct  NUMERIC(6,2),
    score_spec_master         NUMERIC(5,2),
    spec_teachers_science     INTEGER,
    spec_teachers_science_pct NUMERIC(6,2),
    score_spec_science        NUMERIC(5,2),

    -- Участие в экспертизах
    expertise_teachers INTEGER,
    score_expertise    NUMERIC(5,2),

    -- WorldSkills — эксперты
    ws_expert_republic       INTEGER,
    score_ws_expert_republic NUMERIC(5,2),
    ws_expert_intl           INTEGER,
    score_ws_expert_intl     NUMERIC(5,2),

    -- Стажировка за рубежом
    abroad_internship_count INTEGER,
    abroad_internship_pct   NUMERIC(6,2),
    score_abroad_internship NUMERIC(5,2),

    -- Конкурсы профмастерства
    prof_contest_winners    INTEGER,
    score_prof_contest      NUMERIC(5,2),
    industry_teachers_count INTEGER,
    industry_teachers_pct   NUMERIC(6,2),
    score_industry_teachers NUMERIC(5,2),

    -- Успеваемость
    academic_performance_pct NUMERIC(6,2),
    score_academic           NUMERIC(5,2),
    knowledge_quality_pct    NUMERIC(6,2),
    score_knowledge          NUMERIC(5,2),

    -- Приём / выпуск
    admission_count  INTEGER,
    graduates_count  INTEGER,
    graduates_pct    NUMERIC(6,2),
    score_graduates  NUMERIC(5,2),

    -- Жас Маман — результаты
    zm_students_count  INTEGER,
    zm_academic_pct    NUMERIC(6,2),
    score_zm_academic  NUMERIC(5,2),
    zm_quality_pct     NUMERIC(6,2),
    score_zm_quality   NUMERIC(5,2),
    zm_admission_count INTEGER,
    zm_graduates_count INTEGER,
    zm_graduates_pct   NUMERIC(6,2),
    score_zm_graduates NUMERIC(5,2),

    -- WorldSkills — студенты
    ws_student_place_republic VARCHAR(20),
    score_ws_student_republic NUMERIC(5,2),
    ws_student_place_intl     VARCHAR(20),
    score_ws_student_intl     NUMERIC(5,2),

    -- Стартапы
    startup_count  INTEGER,
    score_startups NUMERIC(5,2),

    -- Демонстрационный экзамен
    demo_exam_students INTEGER,
    score_demo_exam    NUMERIC(5,2),

    -- Выпускники-предприниматели
    entrepreneur_graduates INTEGER,
    score_entrepreneurs    NUMERIC(5,2),

    -- Трудоустройство
    employment_graduates   INTEGER,
    employment_employed    VARCHAR(50),
    employment_pct         NUMERIC(6,2),
    score_employment       NUMERIC(5,2),
    zm_employment_graduates INTEGER,
    zm_employment_employed  VARCHAR(50),
    zm_employment_pct       NUMERIC(6,2),
    score_zm_employment     NUMERIC(5,2),

    -- Дуальное обучение
    dual_students_count INTEGER,
    score_dual          NUMERIC(5,2),

    -- Заявки работодателей
    employer_request_count  INTEGER,
    score_employer_requests NUMERIC(5,2),

    -- Итог
    specialty_score NUMERIC(6,2),

    UNIQUE (assessment_id, specialty_raw)
);

CREATE INDEX IF NOT EXISTS idx_cas_assessment ON college_assessment_specialty (assessment_id);
CREATE INDEX IF NOT EXISTS idx_cas_code       ON college_assessment_specialty (specialty_code);
CREATE INDEX IF NOT EXISTS idx_cas_score      ON college_assessment_specialty (specialty_score DESC);
CREATE INDEX IF NOT EXISTS idx_cas_employment ON college_assessment_specialty (employment_pct);

COMMENT ON TABLE college_assessment IS
    'Оценка эффективности колледжей ТиППО по методике АО «Финансовый центр». Данные уровня колледжа.';
COMMENT ON TABLE college_assessment_specialty IS
    'Данные оценки эффективности по специальностям внутри колледжа.';

COMMIT;
