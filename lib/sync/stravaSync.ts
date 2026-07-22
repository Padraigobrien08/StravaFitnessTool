import { upsertActivities } from "@/lib/db/activities";
import { getValidAccessToken } from "@/lib/db/strava-connection";
import { finishSyncRun, startSyncRun } from "@/lib/db/sync-runs";
import { fetchAthleteActivities } from "@/lib/strava/api/fetchActivities";
import { syncStravaStreamsForUser } from "@/lib/sync/stravaStreams";

/** Backfill activities from Strava API into Neon (runs + summaries). */
export async function syncStravaActivitiesForUser(
  userId: string,
  options?: {
    afterEpochSec?: number;
    streamMaxRuns?: number;
    skipStreams?: boolean;
  },
): Promise<{
  synced: number;
  streamsSynced: number;
  syncRunId: string;
}> {
  const syncRunId = await startSyncRun(userId);
  try {
    const { accessToken } = await getValidAccessToken(userId);
    const activities = await fetchAthleteActivities(accessToken, options?.afterEpochSec);
    const synced = await upsertActivities(userId, activities);
    const lastAfter =
      activities.length > 0
        ? Math.floor(new Date(activities[activities.length - 1]!.start_date).getTime() / 1000)
        : null;
    await finishSyncRun(syncRunId, "completed", synced, lastAfter);

    let streamsSynced = 0;
    if (!options?.skipStreams) {
      try {
        const streamResult = await syncStravaStreamsForUser(userId, {
          maxRuns: options?.streamMaxRuns ?? 40,
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
