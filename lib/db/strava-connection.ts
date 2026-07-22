import { getSql } from "./client";
import type { StravaActivityStats, StravaActivityZone } from "@/lib/strava/api/fetchAthlete";
import type { StravaAthlete, StravaTokenResponse } from "@/lib/strava/api/types";
import { fetchAthleteStats, fetchAthleteZones } from "@/lib/strava/api/fetchAthlete";
import { refreshAccessToken } from "@/lib/strava/api/oauth";

export interface StravaConnectionRow {
  user_id: string;
  strava_athlete_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  scopes: string;
  athlete_json: StravaAthlete | null;
  athlete_stats_json?: StravaActivityStats | null;
  athlete_zones_json?: StravaActivityZone[] | null;
}

export async function upsertStravaConnection(
  userId: string,
  tokens: StravaTokenResponse,
): Promise<void> {
  const sql = getSql();
  const existing = await getStravaConnection(userId);
  const athlete = tokens.athlete ?? existing?.athlete_json ?? null;
  const stravaAthleteId =
    tokens.athlete?.id ?? (existing ? Number(existing.strava_athlete_id) : null);
  if (stravaAthleteId == null || !Number.isFinite(stravaAthleteId)) {
    throw new Error("Strava athlete id missing on token update");
  }

  const expiresAt = new Date(tokens.expires_at * 1000);
  await sql`
    INSERT INTO strava_connections (
      user_id, strava_athlete_id, access_token, refresh_token,
      expires_at, scopes, athlete_json, updated_at
    ) VALUES (
      ${userId}::uuid,
      ${stravaAthleteId},
      ${tokens.access_token},
      ${tokens.refresh_token},
      ${expiresAt},
      ${existing?.scopes ?? "read,activity:read_all,profile:read_all"},
      ${athlete ? JSON.stringify(athlete) : null}::jsonb,
      NOW()
    )
    ON CONFLICT (strava_athlete_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      scopes = EXCLUDED.scopes,
      athlete_json = COALESCE(EXCLUDED.athlete_json, strava_connections.athlete_json),
      updated_at = NOW()
  `;
}

export async function getStravaConnection(userId: string): Promise<StravaConnectionRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id, strava_athlete_id, access_token, refresh_token,
           expires_at, scopes, athlete_json, athlete_stats_json, athlete_zones_json
    FROM strava_connections
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `;
  const row = rows[0] as StravaConnectionRow | undefined;
  return row ?? null;
}

/** Returns a valid access token, refreshing if needed. */
export async function getValidAccessToken(
  userId: string,
): Promise<{ accessToken: string; athlete: StravaAthlete | null }> {
  const conn = await getStravaConnection(userId);
  if (!conn) throw new Error("No Strava connection for user");

  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) {
    return {
      accessToken: conn.access_token,
      athlete: conn.athlete_json,
    };
  }

  const tokens = await refreshAccessToken(conn.refresh_token);
  await upsertStravaConnection(userId, tokens);
  const updated = await getStravaConnection(userId);
  return {
    accessToken: tokens.access_token,
    athlete: tokens.athlete ?? updated?.athlete_json ?? null,
  };
}

export async function syncAthleteMetaForUser(userId: string): Promise<void> {
  const conn = await getStravaConnection(userId);
  if (!conn) return;

  const { accessToken } = await getValidAccessToken(userId);
  const athleteId = Number(conn.strava_athlete_id);

  const [stats, zones] = await Promise.all([
    fetchAthleteStats(accessToken, athleteId),
    fetchAthleteZones(accessToken),
  ]);

  const sql = getSql();
  await sql`
    UPDATE strava_connections SET
      athlete_stats_json = ${JSON.stringify(stats)}::jsonb,
      athlete_zones_json = ${JSON.stringify(zones)}::jsonb,
      updated_at = NOW()
    WHERE user_id = ${userId}::uuid
  `;
}
