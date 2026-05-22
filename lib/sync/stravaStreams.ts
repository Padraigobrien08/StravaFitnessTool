import {
  countStreamsForUser,
  listRunIdsMissingStreams,
  upsertFitDetail,
} from "@/lib/db/activity-streams";
import { getValidAccessToken } from "@/lib/db/strava-connection";
import {
  fetchActivityLaps,
  fetchActivityStreams,
} from "@/lib/strava/api/fetchStreams";
import { mapStravaStreamsToFitDetail } from "@/lib/strava/api/mapToFitDetail";

const DEFAULT_MAX_RUNS = 40;
const REQUEST_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncStravaStreamsForUser(
  userId: string,
  options?: { maxRuns?: number }
): Promise<{ streamsSynced: number; skipped: number }> {
  const maxRuns = options?.maxRuns ?? DEFAULT_MAX_RUNS;
  const runIds = await listRunIdsMissingStreams(userId, maxRuns);
  if (runIds.length === 0) {
    return { streamsSynced: 0, skipped: 0 };
  }

  const { accessToken } = await getValidAccessToken(userId);
  let streamsSynced = 0;
  let skipped = 0;

  for (const activityId of runIds) {
    try {
      const [streams, laps] = await Promise.all([
        fetchActivityStreams(accessToken, activityId),
        fetchActivityLaps(accessToken, activityId),
      ]);

      const detail = mapStravaStreamsToFitDetail(
        String(activityId),
        streams,
        laps
      );

      if (!detail) {
        skipped += 1;
      } else {
        await upsertFitDetail(userId, activityId, detail);
        streamsSynced += 1;
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("429")) {
        await sleep(15_000);
        continue;
      }
      skipped += 1;
    }
    await sleep(REQUEST_DELAY_MS);
  }

  return { streamsSynced, skipped };
}

export { countStreamsForUser };
