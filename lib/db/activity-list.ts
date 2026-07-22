import { getSql } from "./client";

const FRESH_SYNC_MS = 24 * 60 * 60 * 1000;

export interface DbActivityRow {
  strava_activity_id: number;
  sport_type: string;
  payload: Record<string, unknown>;
  start_date: Date;
  synced_at: Date;
}

export interface ActivitiesSyncStatus {
  fresh: boolean;
  lastSyncAt: string | null;
  activityCount: number;
  source: "sync_runs" | "activities_max" | "none";
}

export async function getActivitiesSyncStatus(userId: string): Promise<ActivitiesSyncStatus> {
  const sql = getSql();

  const syncRows = await sql`
    SELECT finished_at, activities_synced
    FROM sync_runs
    WHERE user_id = ${userId}::uuid AND status = 'completed'
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 1
  `;
  const sync = syncRows[0] as { finished_at: Date | null; activities_synced: number } | undefined;

  const countRows = await sql`
    SELECT COUNT(*)::int AS n, MAX(synced_at) AS latest
    FROM activities
    WHERE user_id = ${userId}::uuid
  `;
  const { n, latest } = countRows[0] as { n: number; latest: Date | null };

  const lastSyncAt: Date | null = sync?.finished_at ?? latest ?? null;
  const source: ActivitiesSyncStatus["source"] = sync?.finished_at
    ? "sync_runs"
    : latest
      ? "activities_max"
      : "none";

  const fresh =
    n > 0 && lastSyncAt != null && Date.now() - new Date(lastSyncAt).getTime() < FRESH_SYNC_MS;

  return {
    fresh,
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    activityCount: n,
    source,
  };
}

export async function listActivitiesFromDb(
  userId: string,
  options: {
    page?: number;
    per_page?: number;
    after?: number;
    before?: number;
  },
): Promise<{ activities: Record<string, unknown>[]; total: number }> {
  const sql = getSql();
  const page = Math.max(1, options.page ?? 1);
  const per_page = Math.min(Math.max(options.per_page ?? 30, 1), 200);
  const offset = (page - 1) * per_page;

  const afterDate = options.after ? new Date(options.after * 1000).toISOString() : null;
  const beforeDate = options.before ? new Date(options.before * 1000).toISOString() : null;

  const countRows = await sql`
    SELECT COUNT(*)::int AS n FROM activities
    WHERE user_id = ${userId}::uuid
      AND (${afterDate}::timestamptz IS NULL OR start_date >= ${afterDate}::timestamptz)
      AND (${beforeDate}::timestamptz IS NULL OR start_date <= ${beforeDate}::timestamptz)
  `;
  const total = (countRows[0] as { n: number }).n;

  const rows = await sql`
    SELECT strava_activity_id, sport_type, payload, start_date, synced_at
    FROM activities
    WHERE user_id = ${userId}::uuid
      AND (${afterDate}::timestamptz IS NULL OR start_date >= ${afterDate}::timestamptz)
      AND (${beforeDate}::timestamptz IS NULL OR start_date <= ${beforeDate}::timestamptz)
    ORDER BY start_date DESC
    LIMIT ${per_page} OFFSET ${offset}
  `;

  const activities = (rows as DbActivityRow[]).map((r) => {
    const p = r.payload;
    return {
      id: r.strava_activity_id,
      name: p.name ?? "Activity",
      sport_type: r.sport_type,
      type: r.sport_type,
      distance: p.distanceM ?? p.distance ?? 0,
      moving_time: p.movingSec ?? p.moving_time ?? 0,
      elapsed_time: p.elapsedSec ?? p.elapsed_time ?? 0,
      start_date: new Date(r.start_date).toISOString(),
      start_date_local: p.date ?? new Date(r.start_date).toISOString(),
      average_heartrate: p.avgHr ?? p.average_heartrate ?? null,
      total_elevation_gain: p.elevationGainM ?? p.total_elevation_gain ?? null,
      _source: "neon",
    };
  });

  return { activities, total };
}

export async function listAllActivitiesFromDb(
  userId: string,
  options?: { after?: number; before?: number; max?: number },
): Promise<Record<string, unknown>[]> {
  const max = Math.min(options?.max ?? 500, 1000);
  const { activities } = await listActivitiesFromDb(userId, {
    page: 1,
    per_page: max,
    after: options?.after,
    before: options?.before,
  });
  return activities;
}
