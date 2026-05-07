-- ═════════════════════════════════════════════════════════════════════════════
-- 003_extend_finance_records.sql
--
-- Расширяет таблицу finance_records под полную форму финансов (~100 полей).
-- Это САМАЯ ВАЖНАЯ форма для прозрачности государственного финансирования:
--   • откуда приходят деньги (бюджет, гранты, платное обучение, эндаумент)
--   • куда они тратятся (ФОТ, капзатраты, операционные расходы)
--   • какие программы субсидируются и сколько на студента приходится
--
-- Все ADD COLUMN — IF NOT EXISTS, скрипт идемпотентен.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── ВКЛАДКА 1: Общие и валюта ─────────────────────────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS period_year       INTEGER,
    ADD COLUMN IF NOT EXISTS period_quarter    INTEGER,             -- 1..4 или NULL для года
    ADD COLUMN IF NOT EXISTS report_date       DATE,
    ADD COLUMN IF NOT EXISTS currency_code     VARCHAR(3) DEFAULT 'KZT',
    ADD COLUMN IF NOT EXISTS exchange_rate     NUMERIC(10,4);       -- курс к KZT на отчётную дату

-- ─── ВКЛАДКА 2: ДОХОДЫ — Государственный бюджет ────────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS budget_total                NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS budget_state_grant          NUMERIC(18,2),  -- образовательный гос. грант
    ADD COLUMN IF NOT EXISTS budget_target_funding       NUMERIC(18,2),  -- целевое финансирование
    ADD COLUMN IF NOT EXISTS budget_capital_investment   NUMERIC(18,2),  -- капвложения из бюджета
    ADD COLUMN IF NOT EXISTS budget_research_subsidy     NUMERIC(18,2),  -- субсидии на науку
    ADD COLUMN IF NOT EXISTS budget_social_program       NUMERIC(18,2);  -- соц. программы (стипендии)

-- ─── ВКЛАДКА 3: ДОХОДЫ — Платное обучение ──────────────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS paid_tuition_total          NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS paid_tuition_bachelor       NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS paid_tuition_master         NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS paid_tuition_phd            NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS paid_tuition_foreign        NUMERIC(18,2),  -- от иностранных студентов
    ADD COLUMN IF NOT EXISTS paid_tuition_avg_cost       NUMERIC(12,2);  -- средняя стоимость обучения/год

-- ─── ВКЛАДКА 4: ДОХОДЫ — Гранты и контракты ────────────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS research_grants_total       NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS research_grants_count       INTEGER,
    ADD COLUMN IF NOT EXISTS international_grants        NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS international_grants_count  INTEGER,
    ADD COLUMN IF NOT EXISTS commercial_contracts        NUMERIC(18,2),  -- договоры с бизнесом
    ADD COLUMN IF NOT EXISTS commercial_contracts_count  INTEGER,
    ADD COLUMN IF NOT EXISTS grants_json                 JSONB;          -- разбивка по грантам

-- ─── ВКЛАДКА 5: ДОХОДЫ — Эндаумент и частные источники ────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS endowment_balance          NUMERIC(18,2),  -- баланс на конец периода
    ADD COLUMN IF NOT EXISTS endowment_income           NUMERIC(18,2),  -- доход за период
    ADD COLUMN IF NOT EXISTS donations_total            NUMERIC(18,2),  -- благотворительные взносы
    ADD COLUMN IF NOT EXISTS alumni_donations           NUMERIC(18,2),  -- от выпускников
    ADD COLUMN IF NOT EXISTS corporate_sponsorship      NUMERIC(18,2);  -- корпоративное спонсорство

-- ─── ВКЛАДКА 6: ДОХОДЫ — Прочие ────────────────────────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS rent_income                NUMERIC(18,2),  -- сдача помещений
    ADD COLUMN IF NOT EXISTS hostel_income              NUMERIC(18,2),  -- доход от общежитий
    ADD COLUMN IF NOT EXISTS service_income             NUMERIC(18,2),  -- платные услуги
    ADD COLUMN IF NOT EXISTS publication_income         NUMERIC(18,2),  -- издательская деятельность
    ADD COLUMN IF NOT EXISTS other_income               NUMERIC(18,2),  -- прочие
    ADD COLUMN IF NOT EXISTS total_income               NUMERIC(18,2);  -- ИТОГО ВСЕХ ДОХОДОВ

-- ─── ВКЛАДКА 7: РАСХОДЫ — Фонд оплаты труда (ФОТ) ──────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS salary_fund_total          NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS salary_teaching_staff      NUMERIC(18,2),  -- преподаватели
    ADD COLUMN IF NOT EXISTS salary_administrative      NUMERIC(18,2),  -- АУП
    ADD COLUMN IF NOT EXISTS salary_research_staff      NUMERIC(18,2),  -- научные сотрудники
    ADD COLUMN IF NOT EXISTS salary_support_staff       NUMERIC(18,2),  -- технический персонал
    ADD COLUMN IF NOT EXISTS social_tax                 NUMERIC(18,2),  -- соц. налог + отчисления
    ADD COLUMN IF NOT EXISTS bonuses_total              NUMERIC(18,2),  -- премии
    ADD COLUMN IF NOT EXISTS avg_salary_teaching        NUMERIC(12,2),  -- средняя зарплата препода
    ADD COLUMN IF NOT EXISTS avg_salary_research        NUMERIC(12,2);

-- ─── ВКЛАДКА 8: РАСХОДЫ — Капитальные вложения ────────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS capex_total                NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS capex_construction         NUMERIC(18,2),  -- стройка/ремонт
    ADD COLUMN IF NOT EXISTS capex_equipment            NUMERIC(18,2),  -- оборудование
    ADD COLUMN IF NOT EXISTS capex_it_systems           NUMERIC(18,2),  -- IT-инфраструктура
    ADD COLUMN IF NOT EXISTS capex_library              NUMERIC(18,2),  -- библиотечный фонд
    ADD COLUMN IF NOT EXISTS capex_laboratory           NUMERIC(18,2);  -- лабораторное оборудование

-- ─── ВКЛАДКА 9: РАСХОДЫ — Операционные ─────────────────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS opex_utilities             NUMERIC(18,2),  -- ком. услуги
    ADD COLUMN IF NOT EXISTS opex_maintenance           NUMERIC(18,2),  -- содержание зданий
    ADD COLUMN IF NOT EXISTS opex_consumables           NUMERIC(18,2),  -- расходники
    ADD COLUMN IF NOT EXISTS opex_travel                NUMERIC(18,2),  -- командировки
    ADD COLUMN IF NOT EXISTS opex_advertising           NUMERIC(18,2),  -- маркетинг
    ADD COLUMN IF NOT EXISTS opex_other                 NUMERIC(18,2);  -- прочие

-- ─── ВКЛАДКА 10: РАСХОДЫ — Студенческая поддержка ─────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS scholarship_total          NUMERIC(18,2),  -- стипендии
    ADD COLUMN IF NOT EXISTS scholarship_state          NUMERIC(18,2),  -- госстипендия
    ADD COLUMN IF NOT EXISTS scholarship_named          NUMERIC(18,2),  -- именные
    ADD COLUMN IF NOT EXISTS scholarship_social         NUMERIC(18,2),  -- соц. стипендия
    ADD COLUMN IF NOT EXISTS hostel_subsidy             NUMERIC(18,2),  -- субсидии на проживание
    ADD COLUMN IF NOT EXISTS food_subsidy               NUMERIC(18,2),  -- субсидии на питание
    ADD COLUMN IF NOT EXISTS travel_subsidy             NUMERIC(18,2);

-- ─── ВКЛАДКА 11: РАСХОДЫ — Научная и международная деятельность ──────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS research_expenses          NUMERIC(18,2),  -- расходы на науку
    ADD COLUMN IF NOT EXISTS conference_expenses        NUMERIC(18,2),  -- конференции
    ADD COLUMN IF NOT EXISTS publication_expenses       NUMERIC(18,2),  -- публикации
    ADD COLUMN IF NOT EXISTS international_mobility     NUMERIC(18,2),  -- мобильность
    ADD COLUMN IF NOT EXISTS partnership_fees           NUMERIC(18,2),  -- членство в ассоциациях
    ADD COLUMN IF NOT EXISTS total_expenses             NUMERIC(18,2);  -- ИТОГО ВСЕХ РАСХОДОВ

-- ─── ВКЛАДКА 12: КЛЮЧЕВЫЕ КОЭФФИЦИЕНТЫ ПРОЗРАЧНОСТИ ──────────────────────
-- Эти поля могут быть рассчитаны автоматически, но хранить лучше для истории
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS cost_per_student           NUMERIC(12,2),  -- стоимость обучения 1 студ.
    ADD COLUMN IF NOT EXISTS fot_to_budget_ratio        NUMERIC(5,2),   -- доля ФОТ от бюджета %
    ADD COLUMN IF NOT EXISTS state_funding_ratio        NUMERIC(5,2),   -- доля гос. финансирования %
    ADD COLUMN IF NOT EXISTS commercial_ratio           NUMERIC(5,2),   -- доля коммерческих доходов %
    ADD COLUMN IF NOT EXISTS research_to_total_ratio    NUMERIC(5,2);   -- доля расходов на науку %

-- ─── ВКЛАДКА 13: Эффективность и аудит ─────────────────────────────────────
ALTER TABLE finance_records
    ADD COLUMN IF NOT EXISTS audit_passed               BOOLEAN,
    ADD COLUMN IF NOT EXISTS audit_company              VARCHAR(200),   -- название аудитора
    ADD COLUMN IF NOT EXISTS audit_date                 DATE,
    ADD COLUMN IF NOT EXISTS budget_execution_pct       NUMERIC(5,2),   -- исполнение бюджета %
    ADD COLUMN IF NOT EXISTS deficit_amount             NUMERIC(18,2),  -- дефицит/профицит
    ADD COLUMN IF NOT EXISTS reserve_fund               NUMERIC(18,2);  -- резервный фонд

-- ─── ИНДЕКСЫ ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_finance_period_year
    ON finance_records (period_year);
CREATE INDEX IF NOT EXISTS idx_finance_org_year
    ON finance_records (org_id, period_year);
CREATE INDEX IF NOT EXISTS idx_finance_grants_json
    ON finance_records USING GIN (grants_json);

-- ─── КОММЕНТАРИИ ───────────────────────────────────────────────────────────
COMMENT ON COLUMN finance_records.cost_per_student        IS 'Расходы на одного студента в год (тенге) — главный показатель эффективности';
COMMENT ON COLUMN finance_records.fot_to_budget_ratio     IS 'Доля ФОТ от общего бюджета — норма ~50-65%';
COMMENT ON COLUMN finance_records.state_funding_ratio     IS 'Доля гос. финансирования — показатель зависимости от бюджета';
COMMENT ON COLUMN finance_records.budget_execution_pct    IS 'Процент исполнения бюджета — показатель эффективности планирования';
COMMENT ON COLUMN finance_records.grants_json             IS 'Разбивка по грантам: [{name, amount, source, start_date, end_date, status}]';

COMMIT;

\echo ' '
\echo 'Finance schema extended. Total columns:'
SELECT COUNT(*) AS columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'finance_records';
