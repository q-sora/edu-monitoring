-- Migration 015: Явные колонки блоков для оценки эффективности колледжей
-- Вместо вычисления из отдельных score_* полей — храним итог блока напрямую.

BEGIN;

ALTER TABLE college_assessment
    ADD COLUMN IF NOT EXISTS block1_score NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS block2_score NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS block3_score NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS block4_score NUMERIC(6,2);

COMMENT ON COLUMN college_assessment.block1_score IS 'Блок I: Инфраструктура (max 18)';
COMMENT ON COLUMN college_assessment.block2_score IS 'Блок II: Кадры (max 54)';
COMMENT ON COLUMN college_assessment.block3_score IS 'Блок III: Успеваемость (max 28.5)';
COMMENT ON COLUMN college_assessment.block4_score IS 'Блок IV: Трудоустройство (max 21)';

COMMIT;
