-- Coach / MCP: server-side race goal and plan settings (mirrors client stores)

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_weekly_runs INT NOT NULL DEFAULT 3,
  max_weekly_km REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_race_goals (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  distance TEXT NOT NULL CHECK (distance IN ('5k', '10k', 'hm', 'marathon')),
  race_date DATE NOT NULL,
  target_time_sec INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
