-- Persist the saved weekly training plan (calendar week) across devices.
-- The whole TrainingCalendarWeek is stored as JSONB, keyed by (user, week start),
-- mirroring the localStorage index. localStorage remains the offline cache.
CREATE TABLE IF NOT EXISTS training_calendar_weeks (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week       JSONB NOT NULL,
  revision   INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start)
);
