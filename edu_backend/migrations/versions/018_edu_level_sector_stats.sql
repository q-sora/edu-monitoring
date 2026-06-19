-- Migration 018: edu-level sector stats (total orgs and budget in RK)
-- Stores reference data for total organizations count and state order budget in KZT.

CREATE TABLE IF NOT EXISTS edu_level_sector_stats (
  id               serial       PRIMARY KEY,
  edu_level        text         NOT NULL CHECK (edu_level IN ('do','dopo','so','tippo','vipo')),
  period_year      integer      NOT NULL CHECK (period_year >= 2020),
  total_orgs_rk    integer,         -- всего орг в РК по данному уровню
  goz_billion_kzt  numeric(10,1),   -- ГОЗ в млрд тг
  UNIQUE (edu_level, period_year)
);

-- Начальные данные (из текущего хардкода)
INSERT INTO edu_level_sector_stats (edu_level, period_year, total_orgs_rk, goz_billion_kzt) VALUES
  ('do',    2026, 11909,  924.0),
  ('so',    2026,  9193, 3600.0),
  ('dopo',  2026,  2013,  154.0),
  ('tippo', 2026,   763,  514.0),
  ('vipo',  2026,   123,  504.0)
ON CONFLICT (edu_level, period_year) DO UPDATE SET
  total_orgs_rk   = EXCLUDED.total_orgs_rk,
  goz_billion_kzt = EXCLUDED.goz_billion_kzt;
