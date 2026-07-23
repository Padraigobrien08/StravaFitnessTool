-- Recommendation-outcome tracking: record each recommendation when it is made
-- so adherence (did the athlete follow it?) can be evaluated later against
-- actual runs. One JSONB row per (user, recommendation_id); the id is
-- deterministic per producer + target date so re-generation is idempotent.
CREATE TABLE IF NOT EXISTS recommendation_log (
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  record            JSONB NOT NULL,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, recommendation_id)
);
