import { getSql } from "./client";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { FitRunDetailSchema } from "@/lib/strava/fitTypes";

export async function upsertFitDetail(
  userId: string,
  stravaActivityId: number,
  detail: FitRunDetail,
): Promise<void> {
  const sql = getSql();
  const parsed = FitRunDetailSchema.parse(detail);
  await sql`
    INSERT INTO activity_streams (user_id, strava_activity_id, streams_json, synced_at)
    VALUES (
      ${userId}::uuid,
      ${stravaActivityId},
      ${JSON.stringify(parsed)}::jsonb,
      NOW()
    )
    ON CONFLICT (user_id, strava_activity_id) DO UPDATE SET
      streams_json = EXCLUDED.streams_json,
      synced_at = NOW()
  `;
}

export async function getFitDetailForUser(
  userId: string,
  activityId: string,
): Promise<FitRunDetail | null> {
  const sql = getSql();
  const id = Number(activityId);
  if (!Number.isFinite(id)) return null;
  const rows = await sql`
    SELECT streams_json FROM activity_streams
    WHERE user_id = ${userId}::uuid AND strava_activity_id = ${id}
    LIMIT 1
  `;
  const row = rows[0] as { streams_json: FitRunDetail } | undefined;
  if (!row) return null;
  try {
    return FitRunDetailSchema.parse(row.streams_json);
  } catch {
    return null;
  }
}

export async function listRunIdsMissingStreams(userId: string, limit: number): Promise<number[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT a.strava_activity_id
    FROM activities a
    WHERE a.user_id = ${userId}::uuid
      AND a.sport_type = 'Run'
      AND (
        NOT EXISTS (
          SELECT 1 FROM activity_streams s
          WHERE s.user_id = a.user_id
            AND s.strava_activity_id = a.strava_activity_id
        )
        OR EXISTS (
          SELECT 1 FROM activity_streams s
          WHERE s.user_id = a.user_id
            AND s.strava_activity_id = a.strava_activity_id
            AND COALESCE(jsonb_array_length(s.streams_json->'gpsStream'), 0) < 2
        )
      )
    ORDER BY a.start_date DESC
    LIMIT ${limit}
  `;
  return (rows as { strava_activity_id: number }[]).map((r) => Number(r.strava_activity_id));
}

export async function getFitRunIdsForUser(userId: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT strava_activity_id FROM activity_streams
    WHERE user_id = ${userId}::uuid
  `;
  return (rows as { strava_activity_id: number }[]).map((r) => String(r.strava_activity_id));
}

export async function getAllFitDetailsForUser(userId: string): Promise<FitRunDetail[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT streams_json FROM activity_streams
    WHERE user_id = ${userId}::uuid
  `;
  const out: FitRunDetail[] = [];
  for (const row of rows as { streams_json: FitRunDetail }[]) {
    try {
      out.push(FitRunDetailSchema.parse(row.streams_json));
    } catch {
      // skip invalid rows
    }
  }
  return out;
}

export async function countRunsMissingStreams(userId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n
    FROM activities a
    WHERE a.user_id = ${userId}::uuid
      AND a.sport_type = 'Run'
      AND NOT EXISTS (
        SELECT 1 FROM activity_streams s
        WHERE s.user_id = a.user_id
          AND s.strava_activity_id = a.strava_activity_id
      )
  `;
  return (rows[0] as { n: number }).n;
}

export async function countStreamsForUser(userId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM activity_streams
    WHERE user_id = ${userId}::uuid
  `;
  return (rows[0] as { n: number }).n;
}
