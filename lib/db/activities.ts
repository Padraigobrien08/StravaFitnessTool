import { getSql } from "./client";
import { logger } from "@/lib/observability/logger";
import type { StravaImport } from "@/lib/strava/types";
import type { RunActivity } from "@/lib/strava/types";
import {
  mapAthleteProfile,
  mapStravaActivityToRun,
  mapStravaActivityToSummary,
} from "@/lib/strava/api/mapActivity";
import type { StravaActivity, StravaAthlete } from "@/lib/strava/api/types";
import { getFitRunIdsForUser } from "@/lib/db/activity-streams";
import { getStravaConnection } from "@/lib/db/strava-connection";
import { maxHrFromZones, normalizeAthleteZones } from "@/lib/strava/api/normalizeZones";

export async function upsertActivities(
  userId: string,
  activities: StravaActivity[],
): Promise<number> {
  if (activities.length === 0) return 0;
  const sql = getSql();
  let count = 0;
  let skipped = 0;
  for (const a of activities) {
    // `new Date(bad).toISOString()` throws, and this loop is not in a transaction, so
    // one unusable record used to abort the batch mid-write. Worse than the partial
    // write: the sync run is marked failed, the cursor never advances, and every later
    // sync re-fetches the same record and dies in the same place — the athlete's sync
    // is stuck permanently on one bad row. Skipping it lets the rest through.
    const startDate = new Date(a.start_date);
    if (Number.isNaN(startDate.getTime())) {
      skipped++;
      logger.warn({
        event: "activity.unparseable_start_date",
        stravaActivityId: a.id,
        startDate: String(a.start_date),
      });
      continue;
    }
    const run = mapStravaActivityToRun(a);
    const payload = run ?? mapStravaActivityToSummary(a);
    const sport = a.sport_type || a.type;
    await sql`
      INSERT INTO activities (user_id, strava_activity_id, sport_type, payload, start_date)
      VALUES (
        ${userId}::uuid,
        ${a.id},
        ${sport},
        ${JSON.stringify(payload)}::jsonb,
        ${startDate.toISOString()}::timestamptz
      )
      ON CONFLICT (user_id, strava_activity_id) DO UPDATE SET
        sport_type = EXCLUDED.sport_type,
        payload = EXCLUDED.payload,
        start_date = EXCLUDED.start_date,
        synced_at = NOW()
    `;
    count++;
  }
  if (skipped > 0) {
    logger.warn({ event: "activity.batch_partially_skipped", skipped, written: count });
  }
  return count;
}

export async function buildStravaImportFromDb(
  userId: string,
  athlete: StravaAthlete | null,
): Promise<StravaImport> {
  const sql = getSql();
  const rows = await sql`
    SELECT payload, sport_type, start_date
    FROM activities
    WHERE user_id = ${userId}::uuid
    ORDER BY start_date ASC
  `;

  const runs: RunActivity[] = [];
  const allActivities: StravaImport["allActivities"] = [];

  for (const row of rows as {
    payload: RunActivity & { type?: string };
    sport_type: string;
  }[]) {
    const p = row.payload;
    const runSports = new Set(["Run", "TrailRun", "VirtualRun"]);
    if (runSports.has(row.sport_type) && "movingSec" in p) {
      runs.push(p as RunActivity);
    }
    const payload = p as RunActivity;
    allActivities.push({
      id: payload.id,
      date: payload.date,
      name: payload.name,
      type: row.sport_type,
      distanceM: payload.distanceM,
      elapsedSec: payload.elapsedSec,
      movingSec: payload.movingSec ?? payload.elapsedSec,
      avgHr: payload.avgHr ?? null,
      maxHr: payload.maxHr ?? null,
      calories: payload.calories ?? null,
      elevationGainM: payload.elevationGainM ?? null,
    });
  }

  const fitRunIds = await getFitRunIdsForUser(userId);
  const conn = await getStravaConnection(userId);
  const zoneMaxHr = maxHrFromZones(normalizeAthleteZones(conn?.athlete_zones_json));

  const profile = athlete
    ? mapAthleteProfile(athlete)
    : {
        maxHeartRate: null,
        athleteType: null,
        ftp: null,
        measurementPreference: null,
      };
  if (zoneMaxHr != null) {
    profile.maxHeartRate = zoneMaxHr;
  } else if (profile.maxHeartRate == null && athlete?.max_heartrate) {
    profile.maxHeartRate = athlete.max_heartrate;
  }

  return {
    runs,
    profile,
    goals: [],
    allActivities,
    importedAt: new Date().toISOString(),
    exportLabel: "Strava API",
    fitRunIds,
  };
}
