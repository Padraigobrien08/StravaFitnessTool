-- Persisted AthleteMemory: beliefs are recomputed from analytics each session,
-- but their history accumulates here so a belief re-observed across many
-- sessions is more trustworthy and its first-observed date never resets.
-- One row per (user, belief_id); belief_id is a stable literal.
CREATE TABLE IF NOT EXISTS athlete_memory_beliefs (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  belief_id       TEXT NOT NULL,
  belief          JSONB NOT NULL,
  first_observed  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  times_confirmed INT NOT NULL DEFAULT 1,
  last_confirmed  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, belief_id)
);
