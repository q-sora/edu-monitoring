-- ============================================================
-- ЕДИНАЯ БАЗА ДАННЫХ МОНИТОРИНГА СИСТЕМЫ ОБРАЗОВАНИЯ РК
-- Версия 1.0 | PostgreSQL 14+
-- Охватывает: ДО, ДопО, СО, ТиППО, ВиПО, Общежития, ГОНС Келешек
-- ============================================================

-- ============================================================
-- 0. РАСШИРЕНИЯ
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. СПРАВОЧНИКИ (LOOKUP TABLES)
-- ============================================================

-- Типы образовательных организаций
CREATE TABLE org_types (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,  -- 'ДО','ДопО','СО','ТиППО','ВиПО','ГОНС'
    name_ru     TEXT NOT NULL,
    description TEXT
);
INSERT INTO org_types (code, name_ru, description) VALUES
  ('ДО',     'Дошкольное образование', 'Детские сады, мини-центры, ясли'),
  ('ДопО',   'Дополнительное образование', 'Спортшколы, музыкальные, художественные школы'),
  ('СО',     'Среднее образование', 'Школы, лицеи, гимназии, интернаты, лагеря'),
  ('ТиППО',  'Техническое и профессиональное образование', 'Колледжи, профлицеи, ПТШ'),
  ('ВиПО',   'Высшее и послевузовское образование', 'Университеты, академии, институты'),
  ('Общ-е',  'Общежития', 'Общежития при ТиППО и ВиПО'),
  ('ГОНС',   'ГОНС Келешек', 'Государственная образовательная накопительная система');

-- Регионы (области, города респ. значения)
CREATE TABLE regions (
    id       SERIAL PRIMARY KEY,
    code     VARCHAR(10) UNIQUE NOT NULL,
    name_ru  TEXT NOT NULL,
    type     VARCHAR(20) CHECK (type IN ('oblast','city'))  -- область или г.р.з.
);

-- Населённые пункты
CREATE TABLE localities (
    id          SERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES regions(id),
    name_ru     TEXT NOT NULL,
    type        VARCHAR(30), -- город, село, пгт
    UNIQUE (region_id, name_ru)
);

-- Формы собственности
CREATE TABLE ownership_forms (
    id       SERIAL PRIMARY KEY,
    code     VARCHAR(20) UNIQUE NOT NULL,
    name_ru  TEXT NOT NULL
);
INSERT INTO ownership_forms (code, name_ru) VALUES
  ('state',       'Государственная'),
  ('private',     'Частная'),
  ('ppp',         'Государственно-частное партнёрство'),
  ('municipal',   'Коммунальная'),
  ('national',    'Национальная'),
  ('international','Международная');

-- Частотность обновления данных
CREATE TABLE update_frequencies (
    id       SERIAL PRIMARY KEY,
    code     VARCHAR(30) UNIQUE NOT NULL,
    name_ru  TEXT NOT NULL
);
INSERT INTO update_frequencies (code, name_ru) VALUES
  ('daily',       'Ежедневно'),
  ('monthly',     'Ежемесячно'),
  ('quarterly',   'Ежеквартально'),
  ('yearly',      'Ежегодно'),
  ('biannual',    '2 раза в год'),
  ('once',        'Однократно'),
  ('on_change',   'По факту изменения'),
  ('on_event',    'По факту проведения'),
  ('on_need',     'При необходимости'),
  ('on_join',     'По мере включения');

-- Источники данных
CREATE TABLE data_sources (
    id       SERIAL PRIMARY KEY,
    code     VARCHAR(50) UNIQUE NOT NULL,
    name_ru  TEXT NOT NULL,
    url      TEXT
);
INSERT INTO data_sources (code, name_ru, url) VALUES
  ('НОБД',        'Национальная образовательная база данных',     'https://nobd.edu.kz'),
  ('ЕПВО',        'Единый реестр организаций высшего образования','https://epvo.kz'),
  ('eGov',        'Электронное правительство',                    'https://egov.kz'),
  ('elicense',    'Лицензирование',                              'https://elicense.kz'),
  ('АРРФР',       'Агентство по регулированию финрынка',         NULL),
  ('НБ РК',       'Национальный банк РК',                        NULL),
  ('АО ФЦ ЕРД',  'АО Финансовый центр ЕРД',                     NULL),
  ('КОПД',        'Комитет охраны прав детей',                   NULL),
  ('МТСЗН',       'Министерство труда и соцзащиты населения',    NULL),
  ('egov_kz',     'egov.kz',                                     'https://egov.kz'),
  ('НОБД_ЕПВО',   'НОБД / ЕПВО',                                 NULL),
  ('орг_данные',  'Данные самой организации',                    NULL),
  ('Кунделик',    'ИС Кунделик',                                 'https://kundelik.kz'),
  ('Орта_билим',  'ИС Орта билим',                               NULL),
  ('Студом',      'ИС Студом',                                   NULL),
  ('ГБДФЛ',       'ГБД Физических лиц',                         NULL),
  ('ЕНПФ',        'Единый накопительный пенсионный фонд',        NULL);

-- Виды организаций (мини-центр, полного дня и т.д.)
CREATE TABLE org_kinds (
    id          SERIAL PRIMARY KEY,
    org_type_id INTEGER REFERENCES org_types(id),
    name_ru     TEXT NOT NULL
);

-- Языки обучения
CREATE TABLE languages (
    id       SERIAL PRIMARY KEY,
    code     VARCHAR(10) UNIQUE NOT NULL,
    name_ru  TEXT NOT NULL
);
INSERT INTO languages (code, name_ru) VALUES
  ('kz','Казахский'),('ru','Русский'),('en','Английский'),
  ('uz','Узбекский'),('ug','Уйгурский'),('other','Иной');

-- Категории льготников
CREATE TABLE privilege_categories (
    id       SERIAL PRIMARY KEY,
    code     VARCHAR(30) UNIQUE NOT NULL,
    name_ru  TEXT NOT NULL
);
INSERT INTO privilege_categories (code, name_ru) VALUES
  ('many_children', 'Из многодетных семей'),
  ('low_income',    'Из малообеспеченных семей'),
  ('disabled',      'Дети-инвалиды'),
  ('orphan',        'Дети-сироты/без попечения родителей'),
  ('oop',           'Дети с ООП (особые образовательные потребности)'),
  ('foreign',       'Иностранцы'),
  ('susn',          'Категории СУСН');

-- ============================================================
-- 2. ОРГАНИЗАЦИИ
-- ============================================================

CREATE TABLE organizations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_account_id   TEXT,                              -- ID системы учёта (01)
    bin                 VARCHAR(12) UNIQUE,                -- БИН организации (02)
    name_ru             TEXT NOT NULL,                     -- Полное наименование (03)
    org_type_id         INTEGER REFERENCES org_types(id),
    org_kind_id         INTEGER REFERENCES org_kinds(id),
    ownership_form_id   INTEGER REFERENCES ownership_forms(id),
    region_id           INTEGER REFERENCES regions(id),
    locality_id         INTEGER REFERENCES localities(id),
    address_full        TEXT,                              -- Полный адрес (06)
    activity_start_date DATE,                              -- Начало деятельности (12)
    reorganization_date DATE,                              -- Дата реорганизации (13)
    status              VARCHAR(20) DEFAULT 'active'       -- active/reorganized/liquidated
                         CHECK (status IN ('active','reorganized','liquidated')),
    -- ВиПО-специфика
    vuz_status          VARCHAR(30),                       -- национальный/государственный/региональный/частный/международный (15)
    -- Метаданные
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_type ON organizations(org_type_id);
CREATE INDEX idx_org_bin  ON organizations(bin);
CREATE INDEX idx_org_region ON organizations(region_id);

-- Планы развития и стратегические документы
CREATE TABLE org_strategic_docs (
    id              SERIAL PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_type        VARCHAR(50),  -- план развития, стратегический план, отчёт ректора
    title           TEXT,
    doc_date        DATE,
    doc_url         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Договоры поручения/присоединения
CREATE TABLE org_contracts (
    id              SERIAL PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contract_type   VARCHAR(50),  -- поручения, присоединения
    contract_number TEXT,
    signed_date     DATE,
    expiry_date     DATE,
    operator_name   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. ЛИЦЕНЗИРОВАНИЕ И АККРЕДИТАЦИЯ
-- ============================================================

CREATE TABLE licenses (
    id              SERIAL PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    license_number  TEXT,
    issue_date      DATE NOT NULL,
    expiry_date     DATE,
    issuing_body    TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE license_specialties (
    id              SERIAL PRIMARY KEY,
    license_id      INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
    specialty_code  TEXT,
    specialty_name  TEXT NOT NULL,
    level           VARCHAR(30),  -- бакалавр/магистр/PhD/техник/рабочая квалификация
    education_form  VARCHAR(30)   -- очная/заочная/дистанционная/дуальная
);

CREATE TABLE accreditations (
    id              SERIAL PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    accred_type     VARCHAR(30) CHECK (accred_type IN ('national','state','international')),
    accred_body     TEXT,   -- ASIIN, ABET, EUR-ACE, IQAA, НААР и др.
    issue_date      DATE,
    expiry_date     DATE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Направления подготовки (для ТиППО и ВиПО)
CREATE TABLE training_directions (
    id              SERIAL PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    ugse_code       TEXT,          -- код укрупнённой группы специальностей
    ugse_name       TEXT NOT NULL, -- STEM, медицина, педагогика, IT и т.д.
    specialty_code  TEXT,
    specialty_name  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. КОНТИНГЕНТ (обучающиеся/воспитанники/студенты)
-- ============================================================

-- Снимок контингента на дату (агрегированные данные)
CREATE TABLE contingent_snapshots (
    id                      SERIAL PRIMARY KEY,
    org_id                  UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date           DATE NOT NULL,
    total_count             INTEGER,          -- 01 Общая численность
    new_enrolled            INTEGER,          -- 03 Вновь принятые
    withdrawn               INTEGER,          -- 19 Отчисленные
    -- По уровням (для ВиПО и ТиППО)
    bachelor_count          INTEGER,
    master_count            INTEGER,
    phd_count               INTEGER,
    full_time_count         INTEGER,
    distance_count          INTEGER,
    budget_count            INTEGER,
    paid_count              INTEGER,
    -- По классам/курсам (СО, ТиППО, ВиПО)
    by_grade_json           JSONB,            -- {"1":120,"2":115,...}
    -- По специальностям (ТиППО, ВиПО)
    by_specialty_json       JSONB,            -- {"010305":45,...}
    -- По языкам обучения (02)
    kz_lang_count           INTEGER,
    ru_lang_count           INTEGER,
    en_lang_count           INTEGER,
    other_lang_count        INTEGER,
    -- Льготники (04)
    many_children_count     INTEGER,
    low_income_count        INTEGER,
    disabled_count          INTEGER,
    orphan_count            INTEGER,
    oop_count               INTEGER,
    foreign_count           INTEGER,          -- 06
    privileged_share        NUMERIC(5,2),     -- 12 Доля льготников %
    -- Внутренние
    boarding_school_count   INTEGER,          -- 08 в интернате
    prize_winners_json      JSONB,            -- 07 призёры олимпиад по видам
    -- Пробелы
    absences_count          INTEGER,          -- 22 Количество пропусков
    source_id               INTEGER REFERENCES data_sources(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, snapshot_date)
);

CREATE INDEX idx_cont_org_date ON contingent_snapshots(org_id, snapshot_date);

-- Посещаемость (ежедневный табель)
CREATE TABLE attendance_records (
    id          SERIAL PRIMARY KEY,
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    group_name  TEXT,
    present_count   INTEGER,
    absent_count    INTEGER,
    absent_reason_json JSONB,  -- {"болезнь":5,"прочее":2}
    source_id   INTEGER REFERENCES data_sources(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Очередь (для ДО)
CREATE TABLE queue_records (
    id              SERIAL PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    record_date     DATE NOT NULL,
    queue_count     INTEGER,
    age_group       VARCHAR(20),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Зачисление и отчисление (индивидуальные записи)
CREATE TABLE enrollment_records (
    id              SERIAL PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    student_iin     VARCHAR(12),       -- ИИН (для антифрод проверок)
    action          VARCHAR(20) CHECK (action IN ('enrolled','withdrawn','transferred')),
    action_date     DATE NOT NULL,
    grade_or_course TEXT,
    specialty_code  TEXT,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ГРУППЫ / КЛАССЫ
-- ============================================================

CREATE TABLE groups (
    id                  SERIAL PRIMARY KEY,
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
    group_name          TEXT NOT NULL,
    group_type          VARCHAR(50),   -- обычная, инклюзивная, специальная, с ООП
    age_type            VARCHAR(20),   -- одновозрастная, разновозрастная
    language_id         INTEGER REFERENCES languages(id),
    capacity            INTEGER,       -- наполняемость (08)
    circle_section_type TEXT,          -- вид кружка/секции (02)
    attendance_schedule TEXT,          -- 2 раза в неделю / 3 раза и т.п. (10)
    day_duration        VARCHAR(30),   -- полный день / полдня / продлёнка (09)
    is_active           BOOLEAN DEFAULT TRUE,
    effective_from      DATE,
    effective_to        DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ПЕДАГОГИЧЕСКИЙ СОСТАВ И ПЕРСОНАЛ
-- ============================================================

CREATE TABLE staff_snapshots (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    -- Численность (11 - штатное расписание)
    staffing_plan_json          JSONB,         -- штатное расписание по должностям
    total_teachers              INTEGER,       -- 01 Всего педагогов/мастеров ПО
    spec_teachers_count         INTEGER,       -- 02 Дефектологи/логопеды/психологи
    external_examiners          INTEGER,       -- 05 Внешние экзаменаторы (ТиППО/ВиПО)
    production_staff_count      INTEGER,       -- 09 Кадры с производства
    -- Квалификация (08)
    qualification_json          JSONB,         -- {"профессор":5,"доцент":20,"ст.препод":40,...}
    -- Нагрузка (12)
    avg_workload_hours          NUMERIC(6,2),  -- средняя нагрузка в часах
    workload_details_json       JSONB,
    -- Укомплектованность (14)
    staffing_rate               NUMERIC(5,2),  -- % укомплектованности
    teacher_child_ratio         NUMERIC(5,2),  -- 16 соотношение педагог/дети
    avg_experience_years        NUMERIC(5,1),  -- 15 средний опыт
    turnover_rate               NUMERIC(5,2),  -- 13 текучесть кадров %
    -- Развитие (03,04)
    trained_count               INTEGER,       -- прошли ПК/переподготовку
    certified_count             INTEGER,       -- прошли аттестацию
    -- Конкурсы (06,07)
    contest_participants        INTEGER,
    contest_results_json        JSONB,
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, snapshot_date)
);

-- ============================================================
-- 7. ФИНАНСЫ И БЮДЖЕТ
-- ============================================================

CREATE TABLE finance_records (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    period_year                 SMALLINT NOT NULL,
    period_month                SMALLINT,          -- NULL = годовая запись
    -- Источники и объёмы (01,02,03)
    funding_sources_json        JSONB,             -- {"бюджет":X,"внебюджет":Y}
    annual_budget               NUMERIC(18,2),
    state_order_volume          NUMERIC(18,2),
    extra_budget_income         NUMERIC(18,2),     -- 20 внебюджетные доходы
    -- Нормативы (06)
    per_capita_norm             NUMERIC(12,2),     -- подушевой/базовый норматив
    -- Госзаказ (07,08,09,10,11)
    state_order_start_date      DATE,
    state_order_end_date        DATE,
    state_order_planned_amount  NUMERIC(18,2),
    vouchers_issued             INTEGER,           -- 12 количество ваучеров
    payments_to_suppliers       NUMERIC(18,2),     -- 13
    violations_info             TEXT,              -- 08 информация о нарушениях
    return_notification_amount  NUMERIC(18,2),     -- 09/10 возврат
    return_reason               TEXT,
    -- Расходы (детализированные) 22-34
    expenses_utilities          NUMERIC(18,2),     -- 22 ЖКУ, ремонт, МТБ
    expenses_payroll            NUMERIC(18,2),     -- 23 ФОТ
    expenses_antiterror         NUMERIC(18,2),     -- 24 антитеррор
    expenses_food               NUMERIC(18,2),     -- 25 питание
    expenses_medical            NUMERIC(18,2),     -- 26 медобслуживание
    expenses_retraining         NUMERIC(18,2),     -- 27 переквалификация
    expenses_olympiads          NUMERIC(18,2),     -- 28 олимпиады/конкурсы
    expenses_extra_education    NUMERIC(18,2),     -- 29 доп.образование
    expenses_special_equipment  NUMERIC(18,2),     -- 30 оснащение спецгрупп
    expenses_transport          NUMERIC(18,2),     -- 31 развозка
    expenses_rnd                NUMERIC(18,2),     -- 32 НИОКР (ВиПО)
    expenses_scholarships       NUMERIC(18,2),     -- 33 стипендии (ТиППО/ВиПО)
    expenses_boarding           NUMERIC(18,2),     -- 34 содержание интерната (СО)
    -- Платные услуги (14,15,16)
    circle_price_per_session    NUMERIC(10,2),     -- 14 стоимость кружка за занятие
    paid_services_price         NUMERIC(10,2),     -- 15 стоимость платных услуг
    paid_vs_free_ratio          NUMERIC(5,2),      -- 16 % платных к бесплатным
    -- Отчёты
    budget_execution_report_url TEXT,              -- 21 отчёт об исполнении
    payment_orders_count        INTEGER,           -- 03 поручения на оплату
    financing_requests_count    INTEGER,           -- 04 заявки на финансирование
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, period_year, period_month)
);

-- ============================================================
-- 8. ИНФРАСТРУКТУРА
-- ============================================================

CREATE TABLE infrastructure_records (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    -- Здание (01-13)
    building_type               TEXT,              -- 01 тип здания
    technical_condition         VARCHAR(50),       -- 02 техническое состояние
    design_capacity             INTEGER,           -- 03 проектная мощность
    building_area_sqm           NUMERIC(10,2),     -- 04 площадь здания
    area_per_person_sqm         NUMERIC(8,2),      -- 04 площадь на одного
    total_territory_sqm         NUMERIC(12,2),     -- 05 общая площадь территории
    construction_year           SMALLINT,          -- 06
    commissioning_year          SMALLINT,          -- 06
    building_condition_wear_pct NUMERIC(5,2),      -- 07 износ %
    last_repair_date            DATE,              -- 08 последний ремонт
    sanpin_compliance           BOOLEAN,           -- 09 соответствие СанПин
    heating_type                TEXT,              -- 10 вид отопления
    building_count              INTEGER,           -- 11 количество корпусов
    antiterror_security         JSONB,             -- 12 антитеррор
    premises_ownership          VARCHAR(30),       -- 13 собственное/арендуемое
    -- Учебная инфраструктура (15)
    classrooms_count            INTEGER,
    labs_count                  INTEGER,
    workshops_count             INTEGER,
    halls_count                 INTEGER,
    edu_infra_details_json      JSONB,
    -- Спорт (16)
    sports_halls_count          INTEGER,
    stadiums_count              INTEGER,
    sports_infra_json           JSONB,
    -- Доступность (14)
    transport_access            TEXT,
    -- Прочее
    has_library                 BOOLEAN,           -- 17
    library_fund_count          INTEGER,
    has_canteen                 BOOLEAN,           -- 19
    has_internet                BOOLEAN,           -- 18
    has_shuttle                 BOOLEAN,           -- 20
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, snapshot_date)
);

-- Ремонты (история)
CREATE TABLE repair_history (
    id          SERIAL PRIMARY KEY,
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    repair_type VARCHAR(20) CHECK (repair_type IN ('current','capital')),
    start_date  DATE,
    end_date    DATE,
    cost        NUMERIC(18,2),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. ОБОРУДОВАНИЕ И МАТЕРИАЛЫ
-- ============================================================

CREATE TABLE equipment_records (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    -- МТБ (01,02)
    mtb_general_json            JSONB,             -- 01 общая МТБ
    mtb_special_groups_json     JSONB,             -- 02 МТБ для спецгрупп
    -- Учебные материалы (03)
    library_fund_count          INTEGER,
    e_textbooks_count           INTEGER,
    edu_materials_json          JSONB,
    -- Амортизация (04)
    total_equipment_value       NUMERIC(18,2),
    wear_pct                    NUMERIC(5,2),
    avg_service_years           NUMERIC(5,1),
    -- Расходные материалы (05,06)
    consumables_json            JSONB,             -- реактивы, лаб.материалы
    practice_consumables_annual NUMERIC(18,2),     -- объём закупок в год
    -- IT (09)
    computers_count             INTEGER,
    tablets_count               INTEGER,
    interactive_boards_count    INTEGER,
    servers_count               INTEGER,
    simulators_count            INTEGER,
    -- Производственные мастерские (07)
    production_workshops_json   JSONB,
    -- Научное оборудование (08)
    science_equipment_json      JSONB,
    -- Инвестиции (10)
    investments_3y_json         JSONB,             -- по направлениям за 3 года
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, snapshot_date)
);

-- ============================================================
-- 10. ОБРАЗОВАТЕЛЬНЫЙ ПРОЦЕСС
-- ============================================================

CREATE TABLE educational_process (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    -- Программы (01,02,03,04,05)
    mandatory_programs_count    INTEGER,           -- 01
    optional_programs_count     INTEGER,           -- 03
    international_programs_count INTEGER,          -- 02
    additional_programs_json    JSONB,             -- 04 доп.виды программ
    circles_sections_json       JSONB,             -- 05 виды кружков/секций
    -- Среда и активности (06,07,08)
    has_developing_environment  BOOLEAN,           -- 06
    olympiad_participation_json JSONB,             -- 07 участие в олимпиадах
    startup_projects_count      INTEGER,           -- 08
    -- Академическая активность (09,10,11,12)
    parent_survey_results_json  JSONB,             -- 09 опросы родителей
    academic_mobility_json      JSONB,             -- 10 входящая/исходящая (ТиППО/ВиПО)
    academic_performance_json   JSONB,             -- 11 успеваемость
    practice_partners_json      JSONB,             -- 12 практика студентов
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, snapshot_date)
);

-- ============================================================
-- 11. ВЫПУСКНИКИ И ЭКОНОМИЧЕСКИЙ ЭФФЕКТ
-- ============================================================

CREATE TABLE graduates_records (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    graduation_year             SMALLINT NOT NULL,
    -- Численность (01-05)
    graduates_total             INTEGER,           -- 01
    to_tippo_count              INTEGER,           -- 02 поступили в ТиППО
    to_vipo_count               INTEGER,           -- 03 поступили в ВиПО
    to_top_vipo_count           INTEGER,           -- 04 в топовые ВиПО (ЕНТ, Алтын белгі)
    not_enrolled_count          INTEGER,           -- 05
    -- Атестация (06)
    final_attestation_avg_score NUMERIC(5,2),
    final_attestation_pass_pct  NUMERIC(5,2),
    -- Трудоустройство (07,08)
    employed_6m_pct             NUMERIC(5,2),      -- через 6 мес.
    employed_12m_pct            NUMERIC(5,2),
    employed_36m_pct            NUMERIC(5,2),
    employed_60m_pct            NUMERIC(5,2),
    avg_salary_by_specialty_json JSONB,            -- 08 средняя зарплата
    -- Экономический эффект (09,10,11)
    achievements_json           JSONB,             -- 09 достижения
    legal_entities_participation_json JSONB,       -- 10 ИП/ТОО/АО
    taxes_paid_json             JSONB,             -- 11 выплаченные налоги
    -- Опросы (12)
    survey_results_json         JSONB,             -- 12 анкетирование выпускников
    -- Работодатели (13)
    employer_partners_json      JSONB,             -- 13 партнёры-работодатели
    -- Грант (14)
    grant_workback_amount       NUMERIC(18,2),     -- 14 сумма возмещения
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, graduation_year)
);

-- ============================================================
-- 12. МЕЖДУНАРОДНАЯ ДЕЯТЕЛЬНОСТЬ (ТиППО, ВиПО)
-- ============================================================

CREATE TABLE international_activity (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    period_year                 SMALLINT NOT NULL,
    foreign_students_count      INTEGER,           -- 01
    foreign_students_by_country_json JSONB,
    foreign_teachers_count      INTEGER,           -- 02
    foreign_teachers_contract_amount NUMERIC(18,2),
    international_programs_json JSONB,             -- 03 Erasmus, Mevlana и др.
    partner_universities_json   JSONB,             -- 04 зарубежные партнёры
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, period_year)
);

-- ============================================================
-- 13. НАУЧНАЯ ДЕЯТЕЛЬНОСТЬ (ВиПО)
-- ============================================================

CREATE TABLE science_activity (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    period_year                 SMALLINT NOT NULL,
    grants_json                 JSONB,             -- 01 научные гранты: сумма, кол-во, направления
    student_projects_json       JSONB,             -- 02 проекты студентов, стартапы
    hirsch_index_avg            NUMERIC(6,2),      -- 03 средний индекс Хирша ППС
    hirsch_index_max            NUMERIC(6,2),
    publications_q1             INTEGER,           -- 04 публикации Q1
    publications_q2             INTEGER,
    publications_q3             INTEGER,
    publications_q4             INTEGER,
    publications_scopus         INTEGER,
    publications_wos            INTEGER,
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, period_year)
);

-- ============================================================
-- 14. ЦИФРОВИЗАЦИЯ
-- ============================================================

CREATE TABLE digitalization_records (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    -- ИС и платформы (01,02)
    information_systems_json    JSONB,             -- 01 перечень ИС
    digital_platforms_json      JSONB,             -- 02 онлайн-платформы, LMS, прокторинг
    -- Защита (03,04)
    tech_protection_json        JSONB,             -- 03 антивирус, ОС, бэкап
    infosec_docs_json           JSONB,             -- 04 документы по ИБ
    -- ERP (05)
    erp_systems_json            JSONB,             -- 05 ERP/СУБД
    -- Учёт (06)
    auto_accounting_system      TEXT,              -- 06 турникет/FaceID/СКУД
    -- Сайт и приложения (07)
    has_website                 BOOLEAN,
    website_url                 TEXT,
    has_mobile_app              BOOLEAN,
    has_e_library               BOOLEAN,
    has_digital_portfolio       BOOLEAN,
    -- Интернет (08)
    internet_speed_mbps         NUMERIC(8,2),      -- скорость
    internet_tariff             TEXT,
    -- IT-оборудование (09)
    computers_count             INTEGER,
    interactive_boards_count    INTEGER,
    tablets_count               INTEGER,
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, snapshot_date)
);

-- ============================================================
-- 15. МЕДИЦИНСКОЕ ОБСЛУЖИВАНИЕ
-- ============================================================

CREATE TABLE medical_records (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    -- Кабинет (01)
    has_medical_office          BOOLEAN,
    medical_license_number      TEXT,
    medical_license_date        DATE,
    -- Договор (02)
    has_medical_contract        BOOLEAN,
    medical_contractor          TEXT,
    -- Персонал (03)
    medical_staff_plan          INTEGER,
    medical_staff_actual        INTEGER,
    -- Услуги (04)
    examinations_count          INTEGER,
    prevention_events_json      JSONB,
    -- Охрана труда (05)
    safety_briefing_journal     BOOLEAN,
    safety_equipment_json       JSONB,
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, snapshot_date)
);

-- ============================================================
-- 16. ОБЩЕЖИТИЯ
-- ============================================================

-- Объект общежития
CREATE TABLE dormitories (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE, -- организация-балансодержатель
    name                        TEXT NOT NULL,
    address                     TEXT,
    -- Характеристики (14.*)
    construction_year           SMALLINT,          -- 01
    area_total_sqm              NUMERIC(10,2),     -- 02
    area_useful_sqm             NUMERIC(10,2),     -- 03
    land_area_sqm               NUMERIC(10,2),     -- 04
    land_ownership              TEXT,
    auxiliary_rooms_json        JSONB,             -- 05 санузлы, кухни, прачечные
    design_capacity             INTEGER,           -- 06
    technical_condition         TEXT,              -- 07
    wall_material               TEXT,              -- 08
    construction_type           TEXT,
    floors_count                INTEGER,           -- 09
    last_capital_repair_date    DATE,              -- 10
    planned_capacity            INTEGER,           -- 11
    rooms_count                 INTEGER,           -- 12
    rooms_details_json          JSONB,
    balance_holder              TEXT,              -- 'ТиПО','ВУЗ','частный инвестор' (14.09)
    is_active                   BOOLEAN DEFAULT TRUE,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Заявления поставщиков госзаказа на общежития (16.*)
CREATE TABLE dormitory_supplier_contracts (
    id                          SERIAL PRIMARY KEY,
    dormitory_id                UUID REFERENCES dormitories(id),
    supplier_name               TEXT NOT NULL,
    supplier_bin                VARCHAR(12),
    -- Этапы (16.01-16.13)
    application_date            DATE,              -- 01 подача заявления
    prelim_contract_date        DATE,              -- 05
    prelim_contract_number      TEXT,
    commissioning_date          DATE,              -- 11
    state_order_contract_date   DATE,              -- 08
    state_order_contract_period INTEGER,           -- 09 срок договора (лет)
    target_agreement_date       DATE,              -- 06
    target_agreement_reg_date   DATE,              -- 06
    addendum_date               DATE,              -- 07
    addendum_reason             TEXT,
    termination_prelim_date     DATE,              -- 12
    termination_prelim_reason   TEXT,
    termination_contract_date   DATE,              -- 13
    termination_contract_reason TEXT,
    docs_submitted_json         JSONB,             -- 03,04 документы
    forecast_payment_6y         NUMERIC(18,2),     -- 19 прогноз выплат
    status                      VARCHAR(30) DEFAULT 'active',
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Снимок мест и проживания (15.*)
CREATE TABLE dormitory_occupancy (
    id                          SERIAL PRIMARY KEY,
    dormitory_id                UUID REFERENCES dormitories(id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    -- 15.01 мониторинг
    occupied_places             INTEGER,           -- фактически занятые
    total_places                INTEGER,
    -- Финансы общежития
    rent_per_month              NUMERIC(10,2),     -- 18
    paid_services_price         NUMERIC(10,2),     -- 17 прачечная и пр.
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (dormitory_id, snapshot_date)
);

-- Проживающие студенты (15.02-15.09)
CREATE TABLE dormitory_residents (
    id                          SERIAL PRIMARY KEY,
    dormitory_id                UUID REFERENCES dormitories(id) ON DELETE CASCADE,
    student_iin                 VARCHAR(12) NOT NULL,
    student_org_id              UUID REFERENCES organizations(id), -- где учится
    check_in_date               DATE,
    check_out_date              DATE,
    is_current                  BOOLEAN DEFAULT TRUE,
    -- Верификации
    iin_verified_gbdfl          BOOLEAN,           -- 06 корректность ИИН
    residence_verified          BOOLEAN,           -- 05 прописка
    study_place_verified        BOOLEAN,           -- 03/04 место учёбы
    monthly_stay_hours          NUMERIC(5,1),      -- 07 часов в месяц
    registry_correct            BOOLEAN,           -- 09
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Заявки студентов на общежитие (снимок)
CREATE TABLE dormitory_applications (
    id                          SERIAL PRIMARY KEY,
    org_id                      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    applied_count               INTEGER,           -- 23
    approved_count              INTEGER,           -- 24
    rejected_count              INTEGER,
    source_id                   INTEGER REFERENCES data_sources(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, snapshot_date)
);

-- ============================================================
-- 17. ГОНС КЕЛЕШЕК
-- ============================================================

-- Банки и страховые (БВУ/КСЖ)
CREATE TABLE gons_institutions (
    id              SERIAL PRIMARY KEY,
    institution_type VARCHAR(10) CHECK (institution_type IN ('БВУ','КСЖ')),
    name            TEXT NOT NULL,
    bin             VARCHAR(12) UNIQUE,
    license_date    DATE,                          -- 08
    -- Фин.показатели (24)
    assets          NUMERIC(18,2),
    liabilities     NUMERIC(18,2),
    charter_capital NUMERIC(18,2),
    equity          NUMERIC(18,2),
    prudential_compliance_json JSONB,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Договоры сотрудничества (21)
CREATE TABLE gons_cooperation_contracts (
    id                  SERIAL PRIMARY KEY,
    institution_id      INTEGER REFERENCES gons_institutions(id),
    partner_type        TEXT,                     -- ФинЦентр, организация образования
    partner_name        TEXT,
    contract_date       DATE,
    expiry_date         DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Снимок вкладов/договоров страхования (ежедневно)
CREATE TABLE gons_daily_snapshot (
    id                              SERIAL PRIMARY KEY,
    institution_id                  INTEGER REFERENCES gons_institutions(id),
    snapshot_date                   DATE NOT NULL,
    -- Общие (25,26)
    deposits_aquyl_count            INTEGER,       -- 25 количество депозитов Aqyl
    insurance_contracts_count       INTEGER,       -- 26 количество договоров КСЖ
    -- Суммы (35,36,37,38)
    deposits_aquyl_total_amount     NUMERIC(18,2), -- 35
    insurance_premiums_total        NUMERIC(18,2), -- 36
    state_bonus_total               NUMERIC(18,2), -- 37 (5% и 7%)
    sok_total                       NUMERIC(18,2), -- 38 стартовый образ. капитал
    created_at                      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (institution_id, snapshot_date)
);

-- Контингент ГОНС (вкладчики/выгодоприобретатели)
CREATE TABLE gons_beneficiaries_snapshot (
    id                              SERIAL PRIMARY KEY,
    snapshot_date                   DATE NOT NULL,
    institution_id                  INTEGER REFERENCES gons_institutions(id),
    region_id                       INTEGER REFERENCES regions(id),
    -- Численность (27-40)
    total_count                     INTEGER,       -- 27
    by_age_json                     JSONB,         -- 28
    susn_disabled_count             INTEGER,       -- 29 СУСН
    susn_many_children_count        INTEGER,
    susn_low_income_count           INTEGER,
    orphans_count                   INTEGER,       -- 30
    natsfond_combined_count         INTEGER,       -- 35 объединили с Нацфонд-детям
    directed_to_education_count     INTEGER,       -- 31
    directed_to_housing_count       INTEGER,       -- 32
    transferred_to_third_count      INTEGER,       -- 34
    transferred_between_count       INTEGER,       -- 33 между БВУ/КСЖ
    terminated_received_count       INTEGER,       -- 36 расторгли и получили
    kopd_data_json                  JSONB,         -- 37 данные КОПД
    upcoming_5y_contracts_json      JSONB,         -- 38 дети которым исполнится 5 лет
    min_contribution_info_json      JSONB,         -- 40
    natsfond_personal_json          JSONB,         -- 39 персональная информация
    created_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- Персональные данные по вкладам/договорам ГОНС (39-45)
CREATE TABLE gons_personal_records (
    id                              SERIAL PRIMARY KEY,
    institution_id                  INTEGER REFERENCES gons_institutions(id),
    record_type                     VARCHAR(20) CHECK (record_type IN ('active','terminated','directed_edu','directed_housing','directed_third','received','natsfond')),
    beneficiary_iin                 VARCHAR(12),
    full_name                       TEXT,
    deposit_amount                  NUMERIC(18,2),
    insurance_premium               NUMERIC(18,2),
    state_bonus_amount              NUMERIC(18,2),
    sok_amount                      NUMERIC(18,2),
    bank_income                     NUMERIC(18,2),
    target_org_id                   UUID REFERENCES organizations(id), -- организация образования
    closure_reason                  TEXT,
    record_date                     DATE,
    natsfond_amount                 NUMERIC(18,2),
    created_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- Бюджетные заявки ГОНС (27,28)
CREATE TABLE gons_budget_requests (
    id                  SERIAL PRIMARY KEY,
    request_type        VARCHAR(30) CHECK (request_type IN ('state_bonus','sok')),
    period_year         SMALLINT NOT NULL,
    requested_amount    NUMERIC(18,2),
    approved_amount     NUMERIC(18,2),
    submission_date     DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- СОК выписки (29)
CREATE TABLE gons_sok_statements (
    id                  SERIAL PRIMARY KEY,
    beneficiary_iin     VARCHAR(12),
    institution_id      INTEGER REFERENCES gons_institutions(id),
    accrued_amount      NUMERIC(18,2),
    statement_date      DATE NOT NULL,
    contract_type       VARCHAR(10) CHECK (contract_type IN ('вклад','страхование')),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. АНТИФРОД / МОШЕННИЧЕСТВО (13.*)
-- ============================================================

CREATE TABLE fraud_checks (
    id                  SERIAL PRIMARY KEY,
    org_id              UUID REFERENCES organizations(id),
    check_date          DATE NOT NULL,
    check_type          VARCHAR(50),              -- 'ИИН_воспитанника_ДО','ИИН_ученика_СО',...
    checked_count       INTEGER,
    discrepancy_count   INTEGER,
    discrepancy_details JSONB,
    source_id           INTEGER REFERENCES data_sources(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. ОБЩАЯ СВОДНАЯ ТАБЛИЦА (mapping полей по подсистемам)
-- ============================================================

CREATE TABLE field_registry (
    id              SERIAL PRIMARY KEY,
    field_code      VARCHAR(10) NOT NULL,    -- '01','02' и т.д.
    section_code    VARCHAR(10) NOT NULL,    -- '00','01','02'...
    section_name    TEXT NOT NULL,
    field_name      TEXT NOT NULL,
    org_type_code   VARCHAR(20) NOT NULL,    -- 'ДО','СО' и т.д.
    is_enabled      BOOLEAN DEFAULT TRUE,
    source_id       INTEGER REFERENCES data_sources(id),
    frequency_id    INTEGER REFERENCES update_frequencies(id),
    db_table        TEXT,                    -- имя таблицы где хранится
    db_column       TEXT,                   -- имя колонки
    UNIQUE (field_code, section_code, org_type_code)
);

-- ============================================================
-- 20. API TOKENS И АУДИТ
-- ============================================================

CREATE TABLE api_tokens (
    id              SERIAL PRIMARY KEY,
    token_hash      TEXT UNIQUE NOT NULL,
    org_id          UUID REFERENCES organizations(id),
    name            TEXT,
    scopes          TEXT[],              -- ['read','write','admin']
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ
);

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    table_name      TEXT NOT NULL,
    record_id       TEXT NOT NULL,
    action          VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    changed_by      TEXT,
    org_id          UUID,
    old_data        JSONB,
    new_data        JSONB,
    changed_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_org   ON audit_log(org_id);
CREATE INDEX idx_audit_time  ON audit_log(changed_at);

-- ============================================================
-- 21. ФУНКЦИИ ВСПОМОГАТЕЛЬНЫЕ
-- ============================================================

-- Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- 22. ПРЕДСТАВЛЕНИЯ (VIEWS) ДЛЯ API
-- ============================================================

-- Сводка по организации
CREATE VIEW vw_org_summary AS
SELECT
    o.id,
    o.bin,
    o.name_ru,
    ot.code   AS org_type,
    of2.name_ru AS ownership,
    r.name_ru AS region,
    l.name_ru AS locality,
    o.address_full,
    o.status,
    (SELECT MAX(c.snapshot_date) FROM contingent_snapshots c WHERE c.org_id = o.id) AS last_contingent_date,
    (SELECT c.total_count FROM contingent_snapshots c WHERE c.org_id = o.id ORDER BY c.snapshot_date DESC LIMIT 1) AS current_students
FROM organizations o
LEFT JOIN org_types ot ON ot.id = o.org_type_id
LEFT JOIN ownership_forms of2 ON of2.id = o.ownership_form_id
LEFT JOIN regions r ON r.id = o.region_id
LEFT JOIN localities l ON l.id = o.locality_id;

-- Активные лицензии
CREATE VIEW vw_active_licenses AS
SELECT
    o.bin, o.name_ru, ot.code AS org_type,
    li.license_number, li.issue_date, li.expiry_date,
    COUNT(ls.id) AS specialty_count
FROM licenses li
JOIN organizations o ON o.id = li.org_id
JOIN org_types ot ON ot.id = o.org_type_id
LEFT JOIN license_specialties ls ON ls.license_id = li.id
WHERE li.is_active = TRUE
GROUP BY o.bin, o.name_ru, ot.code, li.license_number, li.issue_date, li.expiry_date;

-- Финансы последний месяц
CREATE VIEW vw_latest_finance AS
SELECT DISTINCT ON (org_id)
    f.org_id,
    o.name_ru,
    ot.code AS org_type,
    f.period_year,
    f.period_month,
    f.annual_budget,
    f.state_order_volume,
    f.extra_budget_income,
    f.expenses_payroll,
    f.expenses_utilities
FROM finance_records f
JOIN organizations o ON o.id = f.org_id
JOIN org_types ot ON ot.id = o.org_type_id
ORDER BY f.org_id, f.period_year DESC, f.period_month DESC NULLS LAST;

-- ============================================================
-- КОНЕЦ СХЕМЫ
-- ============================================================
