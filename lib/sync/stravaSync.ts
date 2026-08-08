import { upsertActivities } from "@/lib/db/activities";
import { getValidAccessToken } from "@/lib/db/strava-connection";
import { finishSyncRun, getLastSyncCursor, startSyncRun } from "@/lib/db/sync-runs";
import { fetchAthleteActivities } from "@/lib/strava/api/fetchActivities";
import { syncStravaStreamsForUser } from "@/lib/sync/stravaStreams";
import { DEFAULT_STREAM_RUNS_PER_SYNC } from "@/lib/sync/limits";
import { logger } from "@/lib/observability/logger";

/**
 * How far back to re-scan before the last cursor.
 *
 * An activity can appear with a start_date earlier than one already synced — a watch
 * uploaded late, a manual entry backdated, an edit to an existing activity. Resuming
 * from the exact high-water mark would skip those permanently. Since
 * `upsertActivities` is an upsert keyed on the Strava activity id, re-fetching a
 * window is idempotent and costs one page.
 */
const CURSOR_OVERLAP_SEC = 7 * 24 * 60 * 60;

/**
 * The cursor for the next sync.
 *
 * Deliberately a max rather than `activities[activities.length - 1]`, which is what
 * this used to be. Indexing into either end of the array assumes an ordering the
 * response is not contractually required to hold — `/athlete/activities` is generally
 * reverse-chronological, but that has not been verified here against Strava's docs or
 * a live response, and it is reportedly not the order returned when `after` is
 * supplied. A max needs no such assumption: it is correct under any ordering, so the
 * question does not have to be settled to trust the cursor.
 */
export function nextSyncCursor(startDates: string[]): number | null {
  let max: number | null = null;
  for (const raw of startDates) {
    const epoch = Math.floor(new Date(raw).getTime() / 1000);
    if (!Number.isFinite(epoch)) continue;
    if (max === null || epoch > max) max = epoch;
  }
  return max;
}

/** Backfill activities from Strava API into Neon (runs + summaries). */
export async function syncStravaActivitiesForUser(
  userId: string,
  options?: {
    afterEpochSec?: number;
    streamMaxRuns?: number;
    skipStreams?: boolean;
    /** Ignore the stored cursor and rescan the whole history. */
    full?: boolean;
  },
): Promise<{
  synced: number;
  streamsSynced: number;
  syncRunId: string;
}> {
  const syncRunId = await startSyncRun(userId);
  try {
    const { accessToken } = await getValidAccessToken(userId);

    // Resume from the last completed run unless the caller pinned a start point.
    // `full: true` forces a rescan of the whole history.
    let after = options?.afterEpochSec;
    if (after === undefined && !options?.full) {
      const cursor = await getLastSyncCursor(userId);
      if (cursor !== null) after = Math.max(0, cursor - CURSOR_OVERLAP_SEC);
    }

    const { activities, truncated } = await fetchAthleteActivities(accessToken, after);
    const synced = await upsertActivities(userId, activities);
    const lastAfter = nextSyncCursor(activities.map((a) => a.start_date)) ?? after ?? null;
    await finishSyncRun(syncRunId, "completed", synced, lastAfter);

    logger.info({
      event: "sync.activities",
      userId,
      incremental: after !== undefined,
      fetched: activities.length,
      synced,
      truncated,
    });

    let streamsSynced = 0;
    if (!options?.skipStreams) {
      try {
        const streamResult = await syncStravaStreamsForUser(userId, {
          maxRuns: options?.streamMaxRuns ?? DEFAULT_STREAM_RUNS_PER_SYNC,
        });
        streamsSynced = streamResult.streamsSynced;
      } catch {
        // Streams are optional; activity list still succeeded
      }
    }

    try {
      const { syncAthleteMetaForUser } = await import("@/lib/db/strava-connection");
      await syncAthleteMetaForUser(userId);
    } catch {
      // Stats/zones optional
    }

    return { synced, streamsSynced, syncRunId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    await finishSyncRun(syncRunId, "failed", 0, null, message);
    throw e;
  }
}
