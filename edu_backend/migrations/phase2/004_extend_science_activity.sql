-- ═════════════════════════════════════════════════════════════════════════════
-- 004_extend_science_activity.sql
--
-- Расширяет таблицу science_activity до ~80 полей:
--   • Публикации (по базам Scopus / WoS / РИНЦ / республиканские)
--   • Гранты (МНВО, БРК, международные)
--   • НИОКР и хоздоговоры
--   • Патенты и лицензии
--   • Цитирование и индексы (Хирш)
--   • Международная деятельность
--   • Студенческая наука
--   • Молодые учёные (до 35 лет)
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS period_year                  INTEGER,
    ADD COLUMN IF NOT EXISTS report_date                  DATE;

-- ─── ПУБЛИКАЦИИ ────────────────────────────────────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS publications_total            INTEGER,
    ADD COLUMN IF NOT EXISTS publications_scopus           INTEGER,
    ADD COLUMN IF NOT EXISTS publications_wos              INTEGER,   -- Web of Science
    ADD COLUMN IF NOT EXISTS publications_q1               INTEGER,   -- журналы Q1
    ADD COLUMN IF NOT EXISTS publications_q2               INTEGER,
    ADD COLUMN IF NOT EXISTS publications_q3               INTEGER,
    ADD COLUMN IF NOT EXISTS publications_q4               INTEGER,
    ADD COLUMN IF NOT EXISTS publications_kokson           INTEGER,   -- издания КОКСНВО (РК)
    ADD COLUMN IF NOT EXISTS publications_rinc             INTEGER,   -- РИНЦ
    ADD COLUMN IF NOT EXISTS publications_books            INTEGER,   -- монографии
    ADD COLUMN IF NOT EXISTS publications_textbooks        INTEGER,   -- учебники
    ADD COLUMN IF NOT EXISTS publications_conference_intl  INTEGER,
    ADD COLUMN IF NOT EXISTS publications_conference_local INTEGER,
    ADD COLUMN IF NOT EXISTS publications_open_access      INTEGER;   -- Open Access

-- ─── ГРАНТЫ И ФИНАНСИРОВАНИЕ НАУКИ ─────────────────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS grants_active_count           INTEGER,
    ADD COLUMN IF NOT EXISTS grants_completed_count        INTEGER,
    ADD COLUMN IF NOT EXISTS grants_total_funding          NUMERIC(18,2),  -- общий объём
    ADD COLUMN IF NOT EXISTS grants_state_funding          NUMERIC(18,2),  -- из госбюджета
    ADD COLUMN IF NOT EXISTS grants_international_funding  NUMERIC(18,2),  -- международные
    ADD COLUMN IF NOT EXISTS grants_per_researcher         NUMERIC(12,2),  -- на 1 учёного
    ADD COLUMN IF NOT EXISTS grants_json                   JSONB;          -- список грантов

-- ─── НИОКР И ХОЗДОГОВОРЫ ───────────────────────────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS niokr_total_count             INTEGER,
    ADD COLUMN IF NOT EXISTS niokr_total_funding           NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS niokr_with_industry           INTEGER,         -- с промышленностью
    ADD COLUMN IF NOT EXISTS niokr_implemented             INTEGER,         -- внедрённые в производство
    ADD COLUMN IF NOT EXISTS commercialized_results        INTEGER,         -- коммерциализированные
    ADD COLUMN IF NOT EXISTS commercialization_revenue     NUMERIC(18,2);   -- доход от коммерциализации

-- ─── ПАТЕНТЫ И ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ ─────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS patents_filed                 INTEGER,         -- поданных
    ADD COLUMN IF NOT EXISTS patents_granted_kz            INTEGER,         -- выданных в РК
    ADD COLUMN IF NOT EXISTS patents_granted_intl          INTEGER,         -- выданных за рубежом
    ADD COLUMN IF NOT EXISTS patents_active                INTEGER,         -- действующих
    ADD COLUMN IF NOT EXISTS licenses_sold                 INTEGER,
    ADD COLUMN IF NOT EXISTS licenses_revenue              NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS software_registrations        INTEGER;         -- свидетельства на ПО

-- ─── ЦИТИРОВАНИЕ И НАУКОМЕТРИЯ ────────────────────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS citations_total_scopus        INTEGER,
    ADD COLUMN IF NOT EXISTS citations_total_wos           INTEGER,
    ADD COLUMN IF NOT EXISTS hirsch_index_avg              NUMERIC(5,2),    -- средний H-индекс
    ADD COLUMN IF NOT EXISTS hirsch_index_max              INTEGER,
    ADD COLUMN IF NOT EXISTS researchers_with_h_above_5    INTEGER,         -- H > 5
    ADD COLUMN IF NOT EXISTS researchers_with_h_above_10   INTEGER,
    ADD COLUMN IF NOT EXISTS field_weighted_citation       NUMERIC(5,2);    -- FWCI

-- ─── НАУЧНЫЕ КАДРЫ ─────────────────────────────────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS researchers_total             INTEGER,
    ADD COLUMN IF NOT EXISTS researchers_phd               INTEGER,         -- с PhD/докторской
    ADD COLUMN IF NOT EXISTS researchers_candidate         INTEGER,         -- с кандидатской
    ADD COLUMN IF NOT EXISTS researchers_young             INTEGER,         -- молодые до 35 лет
    ADD COLUMN IF NOT EXISTS researchers_foreign           INTEGER,         -- иностранные
    ADD COLUMN IF NOT EXISTS phd_students_total            INTEGER,         -- докторанты
    ADD COLUMN IF NOT EXISTS phd_dissertations_defended    INTEGER;         -- защищено в году

-- ─── МЕЖДУНАРОДНАЯ НАУЧНАЯ ДЕЯТЕЛЬНОСТЬ ────────────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS intl_partners_count           INTEGER,
    ADD COLUMN IF NOT EXISTS intl_joint_projects           INTEGER,
    ADD COLUMN IF NOT EXISTS intl_conferences_organized    INTEGER,
    ADD COLUMN IF NOT EXISTS intl_visiting_scholars_in     INTEGER,         -- приглашённые к нам
    ADD COLUMN IF NOT EXISTS intl_visiting_scholars_out    INTEGER,         -- наши за рубеж
    ADD COLUMN IF NOT EXISTS visiting_partners_json        JSONB;           -- список партнёров

-- ─── СТУДЕНЧЕСКАЯ НАУКА ────────────────────────────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS student_research_circles      INTEGER,         -- кружков
    ADD COLUMN IF NOT EXISTS student_publications          INTEGER,
    ADD COLUMN IF NOT EXISTS student_conferences           INTEGER,
    ADD COLUMN IF NOT EXISTS student_grants_won            INTEGER,
    ADD COLUMN IF NOT EXISTS student_olympiad_winners      INTEGER;

-- ─── ЦЕНТРЫ И ИНФРАСТРУКТУРА ──────────────────────────────────────────────
ALTER TABLE science_activity
    ADD COLUMN IF NOT EXISTS research_labs_count           INTEGER,
    ADD COLUMN IF NOT EXISTS research_centers_count        INTEGER,
    ADD COLUMN IF NOT EXISTS shared_use_centers            INTEGER,         -- ЦКП
    ADD COLUMN IF NOT EXISTS scientific_journals_published INTEGER;         -- свои журналы

-- ─── ИНДЕКСЫ ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_science_period_year       ON science_activity (period_year);
CREATE INDEX IF NOT EXISTS idx_science_org_year          ON science_activity (org_id, period_year);
CREATE INDEX IF NOT EXISTS idx_science_grants_json       ON science_activity USING GIN (grants_json);
CREATE INDEX IF NOT EXISTS idx_science_partners_json     ON science_activity USING GIN (visiting_partners_json);

-- ─── КОММЕНТАРИИ ───────────────────────────────────────────────────────────
COMMENT ON COLUMN science_activity.field_weighted_citation IS 'FWCI — Field-Weighted Citation Impact из Scopus, ключевой показатель';
COMMENT ON COLUMN science_activity.commercialization_revenue IS 'Доход от коммерциализации научных результатов — главный показатель прикладной отдачи';
COMMENT ON COLUMN science_activity.grants_per_researcher IS 'Гранты на одного учёного — показатель эффективности кадров';

COMMIT;

\echo ' '
\echo 'Science schema extended. Total columns:'
SELECT COUNT(*) AS columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'science_activity';
