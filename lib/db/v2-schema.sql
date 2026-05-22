-- V2 hosted schema stub (Neon Postgres) — not used in V1 local mode

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  export_key TEXT NOT NULL,
  imported_at TIMESTAMPTZ DEFAULT now(),
  run_count INT NOT NULL DEFAULT 0
);

CREATE TABLE runs (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  activity_date TIMESTAMPTZ NOT NULL,
  name TEXT,
  distance_m DOUBLE PRECISION NOT NULL,
  moving_sec INT NOT NULL,
  avg_hr INT,
  training_load INT,
  payload JSONB NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX runs_user_date ON runs (user_id, activity_date DESC);

CREATE TABLE insights_cache (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now()
);
