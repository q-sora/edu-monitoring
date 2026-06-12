-- ═════════════════════════════════════════════════════════════════════════════
-- 006_extend_educational_process.sql
--
-- Расширяет educational_process до ~70 полей:
--   • Преподавательский состав (по званиям, возрасту, степеням)
--   • Специальности (количество, аккредитация)
--   • Академические результаты (средний GPA, отчисления, успеваемость)
--   • Практика и стажировки
--   • Олимпиады и конкурсы
--   • Дополнительное образование (курсы, повышение квалификации)
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE educational_process
    ADD COLUMN IF NOT EXISTS period_year       INTEGER,
    ADD COLUMN IF NOT EXISTS report_date       DATE;

-- ─── ПРЕПОДАВАТЕЛЬСКИЙ СОСТАВ ─────────────────────────────────────────────
ALTER TABLE educational_process
    ADD COLUMN IF NOT EXISTS teachers_total              INTEGER,
    ADD COLUMN IF NOT EXISTS teachers_full_time          INTEGER,
    ADD COLUMN IF NOT EXISTS teachers_part_time          INTEGER,
    ADD COLUMN IF NOT EXISTS teachers_with_phd           INTEGER,
    ADD COLUMN IF NOT EXISTS teachers_with_candidate     INTEGER,        -- кандидат наук
    ADD COLUMN IF NOT EXISTS teachers_with_doctorate     INTEGER,        -- доктор наук
    ADD COLUMN IF NOT EXISTS teachers_professors         INTEGER,        -- профессоров
    ADD COLUMN IF NOT EXISTS teachers_docents            INTEGER,        -- доцентов
    ADD COLUMN IF NOT EXISTS teachers_senior             INTEGER,        -- старших преподавателей
    ADD COLUMN IF NOT EXISTS teachers_assistants         INTEGER,        -- ассистентов
    ADD COLUMN IF NOT EXISTS teachers_under_35           INTEGER,        -- молодые
    ADD COLUMN IF NOT EXISTS teachers_above_60           INTEGER,
    ADD COLUMN IF NOT EXISTS teachers_foreign            INTEGER,
    ADD COLUMN IF NOT EXISTS avg_teacher_age             NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS teacher_to_student_ratio    NUMERIC(5,2);   -- 1 препод на N студентов

-- ─── СПЕЦИАЛЬНОСТИ И ПРОГРАММЫ ─────────────────────────────────────────────
ALTER TABLE educational_process
    ADD COLUMN IF NOT EXISTS specialties_total           INTEGER,
    ADD COLUMN IF NOT EXISTS specialties_bachelor        INTEGER,
    ADD COLUMN IF NOT EXISTS specialties_master          INTEGER,
    ADD COLUMN IF NOT EXISTS specialties_phd             INTEGER,
    ADD COLUMN IF NOT EXISTS specialties_accredited      INTEGER,        -- с аккредитацией
    ADD COLUMN IF NOT EXISTS specialties_intl_accredited INTEGER,        -- международная аккред.
    ADD COLUMN IF NOT EXISTS dual_degree_programs        INTEGER,        -- двойные дипломы
    ADD COLUMN IF NOT EXISTS english_programs            INTEGER,        -- на английском языке
    ADD COLUMN IF NOT EXISTS new_programs_launched       INTEGER;        -- новых в этом году

-- ─── АКАДЕМИЧЕСКИЕ РЕЗУЛЬТАТЫ ──────────────────────────────────────────────
ALTER TABLE educational_process
    ADD COLUMN IF NOT EXISTS avg_gpa                     NUMERIC(4,2),   -- средний GPA
    ADD COLUMN IF NOT EXISTS gpa_above_3_5_count         INTEGER,        -- студентов с GPA > 3.5
    ADD COLUMN IF NOT EXISTS gpa_below_2_0_count         INTEGER,
    ADD COLUMN IF NOT EXISTS expulsion_total             INTEGER,        -- отчислено всего
    ADD COLUMN IF NOT EXISTS expulsion_academic          INTEGER,        -- за неуспеваемость
    ADD COLUMN IF NOT EXISTS expulsion_financial         INTEGER,        -- за неоплату
    ADD COLUMN IF NOT EXISTS expulsion_personal          INTEGER,        -- по собственному
    ADD COLUMN IF NOT EXISTS retention_rate              NUMERIC(5,2),   -- % удержания
    ADD COLUMN IF NOT EXISTS pass_rate_first_attempt     NUMERIC(5,2),   -- % сдавших с первого раза
    ADD COLUMN IF NOT EXISTS state_exam_pass_rate        NUMERIC(5,2);   -- % сдавших ИГА

-- ─── ПРАКТИКА И СТАЖИРОВКИ ─────────────────────────────────────────────────
ALTER TABLE educational_process
    ADD COLUMN IF NOT EXISTS internship_partners_count   INTEGER,        -- баз практики
    ADD COLUMN IF NOT EXISTS students_on_internship      INTEGER,
    ADD COLUMN IF NOT EXISTS students_internship_abroad  INTEGER,        -- за рубежом
    ADD COLUMN IF NOT EXISTS dual_education_count        INTEGER,        -- дуальное обучение
    ADD COLUMN IF NOT EXISTS academic_mobility_in        INTEGER,        -- к нам на семестр
    ADD COLUMN IF NOT EXISTS academic_mobility_out       INTEGER;        -- от нас на семестр

-- ─── ОЛИМПИАДЫ И КОНКУРСЫ ──────────────────────────────────────────────────
ALTER TABLE educational_process
    ADD COLUMN IF NOT EXISTS olympiad_participants       INTEGER,
    ADD COLUMN IF NOT EXISTS olympiad_winners_intl       INTEGER,        -- победителей международных
    ADD COLUMN IF NOT EXISTS olympiad_winners_republic   INTEGER,        -- республиканских
    ADD COLUMN IF NOT EXISTS olympiad_winners_regional   INTEGER,
    ADD COLUMN IF NOT EXISTS competition_winners_total   INTEGER;

-- ─── ДОПОЛНИТЕЛЬНОЕ ОБРАЗОВАНИЕ ────────────────────────────────────────────
ALTER TABLE educational_process
    ADD COLUMN IF NOT EXISTS continuing_education_count  INTEGER,        -- слушателей доп. курсов
    ADD COLUMN IF NOT EXISTS qualification_courses       INTEGER,        -- курсов повышения квал.
    ADD COLUMN IF NOT EXISTS retraining_programs         INTEGER,        -- переподготовка
    ADD COLUMN IF NOT EXISTS certificates_issued         INTEGER;        -- выдано сертификатов

-- ─── ИНФРАСТРУКТУРА ОБУЧЕНИЯ ──────────────────────────────────────────────
ALTER TABLE educational_process
    ADD COLUMN IF NOT EXISTS classrooms_total            INTEGER,
    ADD COLUMN IF NOT EXISTS computer_classrooms         INTEGER,
    ADD COLUMN IF NOT EXISTS lab_classrooms              INTEGER,
    ADD COLUMN IF NOT EXISTS library_books_count         INTEGER,
    ADD COLUMN IF NOT EXISTS library_electronic_resources INTEGER,       -- электронных подписок
    ADD COLUMN IF NOT EXISTS lms_platform_used           VARCHAR(100);   -- Moodle/Canvas/Univer

-- ─── ИНДЕКСЫ ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_education_period_year ON educational_process (period_year);
CREATE INDEX IF NOT EXISTS idx_education_org_year    ON educational_process (org_id, period_year);

COMMENT ON COLUMN educational_process.teacher_to_student_ratio IS 'Соотношение преподаватель/студент — норма 1:10–15 для качественного обучения';
COMMENT ON COLUMN educational_process.retention_rate IS '% студентов, продолживших обучение — главный показатель качества';

COMMIT;

\echo 'Education schema extended.'
SELECT COUNT(*) AS columns FROM information_schema.columns WHERE table_name = 'educational_process';
