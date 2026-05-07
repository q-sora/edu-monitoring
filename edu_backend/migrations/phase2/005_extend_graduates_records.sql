-- ═════════════════════════════════════════════════════════════════════════════
-- 005_extend_graduates_records.sql
--
-- Расширяет graduates_records до ~80 полей:
--   • Выпуск (по уровням, формам, источникам финансирования)
--   • Трудоустройство (по секторам, регионам, срокам)
--   • Зарплаты (1й/3й/5й год, по специальностям)
--   • Работодатели (партнёры, удовлетворённость)
--   • Продолжение образования (магистратура, докторантура, за рубежом)
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE graduates_records
    ADD COLUMN IF NOT EXISTS period_year       INTEGER,
    ADD COLUMN IF NOT EXISTS report_date       DATE;

-- ─── ВЫПУСК ────────────────────────────────────────────────────────────────
ALTER TABLE graduates_records
    ADD COLUMN IF NOT EXISTS total_graduates              INTEGER,
    ADD COLUMN IF NOT EXISTS graduates_bachelor           INTEGER,
    ADD COLUMN IF NOT EXISTS graduates_master             INTEGER,
    ADD COLUMN IF NOT EXISTS graduates_phd                INTEGER,
    ADD COLUMN IF NOT EXISTS graduates_specialist         INTEGER,        -- специалитет (мед.)
    ADD COLUMN IF NOT EXISTS graduates_full_time          INTEGER,
    ADD COLUMN IF NOT EXISTS graduates_part_time          INTEGER,
    ADD COLUMN IF NOT EXISTS graduates_with_honors        INTEGER,        -- с отличием
    ADD COLUMN IF NOT EXISTS graduates_grant_funded       INTEGER,
    ADD COLUMN IF NOT EXISTS graduates_paid_funded        INTEGER,
    ADD COLUMN IF NOT EXISTS graduates_foreign            INTEGER;

-- ─── ТРУДОУСТРОЙСТВО ──────────────────────────────────────────────────────
ALTER TABLE graduates_records
    ADD COLUMN IF NOT EXISTS employed_count               INTEGER,
    ADD COLUMN IF NOT EXISTS employed_by_specialty        INTEGER,        -- по специальности
    ADD COLUMN IF NOT EXISTS employed_other_field         INTEGER,        -- не по специальности
    ADD COLUMN IF NOT EXISTS unemployed_count             INTEGER,
    ADD COLUMN IF NOT EXISTS self_employed                INTEGER,        -- самозанятые
    ADD COLUMN IF NOT EXISTS started_business             INTEGER,        -- открыли свой бизнес
    ADD COLUMN IF NOT EXISTS military_service             INTEGER,        -- ушли в армию
    ADD COLUMN IF NOT EXISTS maternity_leave              INTEGER,        -- декрет
    ADD COLUMN IF NOT EXISTS continue_education           INTEGER,        -- продолжили учёбу
    ADD COLUMN IF NOT EXISTS continue_education_master    INTEGER,        -- в магистратуру
    ADD COLUMN IF NOT EXISTS continue_education_phd       INTEGER,        -- в докторантуру
    ADD COLUMN IF NOT EXISTS continue_education_abroad    INTEGER;        -- за рубежом

-- ─── ТРУДОУСТРОЙСТВО — ПО СЕКТОРАМ ────────────────────────────────────────
ALTER TABLE graduates_records
    ADD COLUMN IF NOT EXISTS employed_state_sector        INTEGER,        -- госсектор
    ADD COLUMN IF NOT EXISTS employed_private_sector      INTEGER,        -- частный
    ADD COLUMN IF NOT EXISTS employed_education_sector    INTEGER,        -- образование
    ADD COLUMN IF NOT EXISTS employed_healthcare          INTEGER,
    ADD COLUMN IF NOT EXISTS employed_it_sector           INTEGER,
    ADD COLUMN IF NOT EXISTS employed_industrial          INTEGER,        -- промышленность
    ADD COLUMN IF NOT EXISTS employed_agriculture         INTEGER,
    ADD COLUMN IF NOT EXISTS employed_finance             INTEGER,
    ADD COLUMN IF NOT EXISTS employed_other               INTEGER;

-- ─── ТРУДОУСТРОЙСТВО — ГЕОГРАФИЯ ──────────────────────────────────────────
ALTER TABLE graduates_records
    ADD COLUMN IF NOT EXISTS employed_in_region           INTEGER,        -- остались в регионе
    ADD COLUMN IF NOT EXISTS employed_other_region        INTEGER,        -- в другом регионе РК
    ADD COLUMN IF NOT EXISTS employed_abroad              INTEGER;        -- за рубежом

-- ─── ЗАРПЛАТЫ ──────────────────────────────────────────────────────────────
ALTER TABLE graduates_records
    ADD COLUMN IF NOT EXISTS avg_salary_first_year        NUMERIC(12,2),  -- первый год
    ADD COLUMN IF NOT EXISTS avg_salary_third_year        NUMERIC(12,2),  -- третий год
    ADD COLUMN IF NOT EXISTS avg_salary_fifth_year        NUMERIC(12,2),  -- пятый год
    ADD COLUMN IF NOT EXISTS median_salary_first_year     NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS min_salary_first_year        NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS max_salary_first_year        NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS salary_above_national_median INTEGER;       -- сколько получают > медианы по РК

-- ─── СРОКИ ТРУДОУСТРОЙСТВА ────────────────────────────────────────────────
ALTER TABLE graduates_records
    ADD COLUMN IF NOT EXISTS employed_within_1_month      INTEGER,
    ADD COLUMN IF NOT EXISTS employed_within_3_months     INTEGER,
    ADD COLUMN IF NOT EXISTS employed_within_6_months     INTEGER,
    ADD COLUMN IF NOT EXISTS employed_within_1_year       INTEGER;

-- ─── РАБОТОДАТЕЛИ ─────────────────────────────────────────────────────────
ALTER TABLE graduates_records
    ADD COLUMN IF NOT EXISTS partner_employers_count      INTEGER,
    ADD COLUMN IF NOT EXISTS employer_satisfaction        NUMERIC(5,2),  -- % удовлетворённости
    ADD COLUMN IF NOT EXISTS graduate_satisfaction        NUMERIC(5,2),  -- сами выпускники
    ADD COLUMN IF NOT EXISTS employer_partners_json       JSONB;         -- список крупных работодателей

-- ─── ИНДЕКСЫ ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_graduates_period_year ON graduates_records (period_year);
CREATE INDEX IF NOT EXISTS idx_graduates_org_year    ON graduates_records (org_id, period_year);
CREATE INDEX IF NOT EXISTS idx_graduates_partners    ON graduates_records USING GIN (employer_partners_json);

COMMENT ON COLUMN graduates_records.avg_salary_first_year IS 'Средняя зарплата выпускников через 1 год — главный показатель ROI образования';
COMMENT ON COLUMN graduates_records.employed_by_specialty IS 'Трудоустроенные ПО специальности — показатель релевантности образования';
COMMENT ON COLUMN graduates_records.employer_partners_json IS '[{name, sector, hired_count, agreement_date}]';

COMMIT;

\echo 'Graduates schema extended.'
SELECT COUNT(*) AS columns FROM information_schema.columns WHERE table_name = 'graduates_records';
