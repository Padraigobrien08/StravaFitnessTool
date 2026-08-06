-- Learning-loop outcome tracking.
--
-- Distinct from `recommendation_log` (migration 005), which stores
-- `LoggedRecommendation` for adherence evaluation. This table stores
-- `TrackedRecommendationOutcome` for the belief-updating loop: a recommendation is
-- recorded when issued and judged once enough time has passed for an effect to exist.
--
-- The two are kept apart deliberately — `getRecommendations` types its `record`
-- column as `LoggedRecommendation`, so mixing a second shape into that table would
-- hand adherence evaluation rows it cannot read.
--
-- Before this, the loop's store was an in-memory Map, so a pending outcome never
-- survived to the request that could have judged it and the loop could not close.
CREATE TABLE IF NOT EXISTS recommendation_outcome_log (
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  record            JSONB NOT NULL,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, recommendation_id)
);

-- Hydration reads a user's most recent outcomes on every adaptive build.
CREATE INDEX IF NOT EXISTS recommendation_outcome_log_user_issued_idx
  ON recommendation_outcome_log (user_id, issued_at DESC);
