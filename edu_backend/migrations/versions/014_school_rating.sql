-- 014_school_rating.sql
-- Module: School Rating System for АО «Финансовый центр»

-- 1. Таблица сабмишнов рейтинга школ
CREATE TABLE school_rating_submissions (
    id                SERIAL PRIMARY KEY,
    school_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    submitted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    academic_year     INTEGER NOT NULL,
    submission_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    raw_data          JSONB NOT NULL DEFAULT '{}'::jsonb,
    scores            JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Audit fields (from FullAuditMixin)
    version           INTEGER NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    created_by        VARCHAR(36),
    updated_by        VARCHAR(36),
    deleted_at        TIMESTAMPTZ,
    deleted_by        VARCHAR(36)
);

-- 2. Индексы
CREATE INDEX ix_school_rating_school_id ON school_rating_submissions(school_id);
CREATE INDEX ix_school_rating_academic_year ON school_rating_submissions(academic_year);
CREATE INDEX ix_school_rating_status ON school_rating_submissions(submission_status);

-- 3. Триггер обновления updated_at
CREATE TRIGGER set_updated_at_school_rating
  BEFORE UPDATE ON school_rating_submissions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 4. Уникальность на уровне (школа, год) при условии, что запись не удалена
CREATE UNIQUE INDEX uq_school_rating_active ON school_rating_submissions (school_id, academic_year) 
WHERE deleted_at IS NULL;

-- 5. Комментарии (согласно стандартам ФЦ)
COMMENT ON TABLE school_rating_submissions IS 'Сабмишны рейтинга школ (Блоки А-Ж)';
COMMENT ON COLUMN school_rating_submissions.raw_data IS 'Исходные данные формы сбора';
COMMENT ON COLUMN school_rating_submissions.scores IS 'Результаты расчёта (total_score и block_scores)';
