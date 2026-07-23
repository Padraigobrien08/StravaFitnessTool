-- Self-auditing calibration: record each race forecast when made so it can be
-- scored against the actual effort once one lands at that distance. One JSONB
-- row per (user, forecast_id); the id is deterministic per distance + issue day.
CREATE TABLE IF NOT EXISTS forecast_log (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  forecast_id TEXT NOT NULL,
  record      JSONB NOT NULL,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, forecast_id)
);
