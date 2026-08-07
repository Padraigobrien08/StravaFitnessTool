import {
  countStreamsForUser,
  listRunIdsMissingStreams,
  upsertFitDetail,
} from "@/lib/db/activity-streams";
import { getValidAccessToken } from "@/lib/db/strava-connection";
import { fetchActivityLaps, fetchActivityStreams } from "@/lib/strava/api/fetchStreams";
import { mapStravaStreamsToFitDetail } from "@/lib/strava/api/mapToFitDetail";
import { DEFAULT_STREAM_RUNS_PER_SYNC } from "@/lib/sync/limits";

const REQUEST_DELAY_MS = 300;

/** How long to wait out a 429 before trying the same activity again. */
export const RATE_LIMIT_BACKOFF_MS = 15_000;

/**
 * How many rate-limit waits to absorb before giving up for this run.
 *
 * The old code slept 15s per 429 with no ceiling. With the route's limit now allowing
 * 200 runs, a rate-limited athlete could hold a serverless invocation for 50 minutes —
 * far past any platform timeout, so the function would be killed mid-run and the
 * caller would see a generic failure rather than "rate limited, try later".
 *
 * Two waits is enough to ride out an incidental limit. Beyond that Strava is telling
 * us to stop, and the right response is to stop and report it: the remaining
 * activities are still missing streams, so the next run picks them up.
 */
export const MAX_RATE_LIMIT_WAITS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimit(e: unknown): boolean {
  return e instanceof Error && e.message.includes("429");
}

export interface StreamSyncResult {
  streamsSynced: number;
  skipped: number;
  /** True when the run stopped early because Strava kept rate-limiting us. */
  rateLimited: boolean;
  /**
   * Activities the run never reached because it stopped early. Distinct from the
   * route's `remaining`, which counts everything still missing streams in the
   * database — this is only what this invocation left on the table.
   */
  notAttempted: number;
}

export async function syncStravaStreamsForUser(
  userId: string,
  options?: { maxRuns?: number },
): Promise<StreamSyncResult> {
  const maxRuns = options?.maxRuns ?? DEFAULT_STREAM_RUNS_PER_SYNC;
  const runIds = await listRunIdsMissingStreams(userId, maxRuns);
  if (runIds.length === 0) {
    return { streamsSynced: 0, skipped: 0, rateLimited: false, notAttempted: 0 };
  }

  const { accessToken } = await getValidAccessToken(userId);
  let streamsSynced = 0;
  let skipped = 0;
  let waitsUsed = 0;

  for (let i = 0; i < runIds.length; i++) {
    const activityId = runIds[i]!;
    let done = false;

    // Retry *this* activity after a rate-limit wait. The previous code used
    // `continue`, which advanced to the next id — so the rate-limited activity was
    // neither fetched nor counted, and the backoff protected the following item
    // rather than retrying the one that failed.
    while (!done) {
      try {
        const [streams, laps] = await Promise.all([
          fetchActivityStreams(accessToken, activityId),
          fetchActivityLaps(accessToken, activityId),
        ]);

        const detail = mapStravaStreamsToFitDetail(String(activityId), streams, laps);

        if (!detail) {
          skipped += 1;
        } else {
          await upsertFitDetail(userId, activityId, detail);
          streamsSynced += 1;
        }
        done = true;
      } catch (e) {
        if (isRateLimit(e) && waitsUsed < MAX_RATE_LIMIT_WAITS) {
          waitsUsed += 1;
          await sleep(RATE_LIMIT_BACKOFF_MS);
          continue; // retry the same activity
        }
        if (isRateLimit(e)) {
          // Budget spent. Everything from here on is untouched, not skipped.
          return {
            streamsSynced,
            skipped,
            rateLimited: true,
            notAttempted: runIds.length - i,
          };
        }
        skipped += 1;
        done = true;
      }
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { streamsSynced, skipped, rateLimited: false, notAttempted: 0 };
}

export { countStreamsForUser };
