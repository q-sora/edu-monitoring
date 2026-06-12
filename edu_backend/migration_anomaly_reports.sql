-- Migration: anomaly_reports table
-- AI Anomaly Detection module

CREATE TABLE IF NOT EXISTS anomaly_reports (
    id                  SERIAL PRIMARY KEY,
    sphere              VARCHAR(50)   NOT NULL,          -- contingent|finance|science|graduates|education
    region_id           INTEGER       REFERENCES regions(id),
    year                INTEGER       NOT NULL,
    severity            VARCHAR(20)   NOT NULL DEFAULT 'warning',  -- critical|warning|info
    metric_name         VARCHAR(200)  NOT NULL,
    metric_label        VARCHAR(200),
    raw_value           NUMERIC,
    expected_value      NUMERIC,
    deviation_pct       NUMERIC,
    z_score             NUMERIC,
    trend_json          JSONB,        -- [{year, value, national_avg}]  for sparkline
    ai_explanation_json JSONB,        -- {summary, reasons:[...], recommendation, context}
    status              VARCHAR(20)   NOT NULL DEFAULT 'new',  -- new|reviewed|dismissed
    scan_run_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_anomaly_sphere      ON anomaly_reports(sphere);
CREATE INDEX IF NOT EXISTS ix_anomaly_region_id   ON anomaly_reports(region_id);
CREATE INDEX IF NOT EXISTS ix_anomaly_year        ON anomaly_reports(year);
CREATE INDEX IF NOT EXISTS ix_anomaly_severity    ON anomaly_reports(severity);
CREATE INDEX IF NOT EXISTS ix_anomaly_status      ON anomaly_reports(status);
CREATE INDEX IF NOT EXISTS ix_anomaly_created_at  ON anomaly_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_anomaly_scan_run_at ON anomaly_reports(scan_run_at DESC);

-- One record per (sphere, region, year, metric) — re-scan updates in-place
CREATE UNIQUE INDEX IF NOT EXISTS uq_anomaly_scan
    ON anomaly_reports(sphere, region_id, year, metric_name);
