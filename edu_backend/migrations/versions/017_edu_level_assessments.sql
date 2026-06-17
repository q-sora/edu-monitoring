-- Migration 017: edu-level indicator assessments
-- Stores indicator model assessment results per organization per year.

CREATE TABLE IF NOT EXISTS org_indicator_assessments (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    edu_level    text        NOT NULL CHECK (edu_level IN ('do','dopo','so','tippo','vipo')),
    period_year  int         NOT NULL CHECK (period_year BETWEEN 2020 AND 2035),
    total_score  numeric(5,2) NOT NULL CHECK (total_score BETWEEN 0 AND 100),
    zone         text        NOT NULL GENERATED ALWAYS AS (
        CASE
            WHEN total_score >= 70 THEN 'green'
            WHEN total_score >= 40 THEN 'yellow'
            ELSE 'red'
        END
    ) STORED,
    scores_json  jsonb,      -- {block_id: {score, max_score, indicators: {id: score}}}
    assessed_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
    assessed_at  timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    UNIQUE (org_id, period_year)
);

CREATE INDEX idx_oia_edu_level_year ON org_indicator_assessments (edu_level, period_year);
CREATE INDEX idx_oia_org_id         ON org_indicator_assessments (org_id);
CREATE INDEX idx_oia_zone           ON org_indicator_assessments (zone);

COMMENT ON TABLE org_indicator_assessments IS
    'Результаты оценки организации по индикаторной модели (0–100 баллов, 3 зоны).';
