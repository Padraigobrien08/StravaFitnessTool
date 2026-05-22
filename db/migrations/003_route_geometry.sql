-- Route intelligence (PostGIS-ready, Phase 2)
-- Today: GPS lives in activity_streams.streams_json.gpsStream (JSONB).
-- Future: normalize high-resolution routes for spatial queries.

-- CREATE EXTENSION IF NOT EXISTS postgis;

-- CREATE TABLE IF NOT EXISTS route_geometries (
--   user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   activity_id TEXT NOT NULL,
--   line GEOMETRY(LineStringZ, 4326),
--   distance_m DOUBLE PRECISION,
--   duration_sec DOUBLE PRECISION,
--   synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   PRIMARY KEY (user_id, activity_id)
-- );
-- CREATE INDEX IF NOT EXISTS idx_route_geometries_line ON route_geometries USING GIST (line);
