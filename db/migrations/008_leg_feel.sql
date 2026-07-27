-- Leg-feel / subjective wellness daily log.
-- One row per (user, day). The JSONB payload is forward-compatible with
-- additional wellness fields (sleep, soreness, stress) without a schema change.
CREATE TABLE IF NOT EXISTS leg_feel_log (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feel_date  DATE NOT NULL,
  report     JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feel_date)
);
