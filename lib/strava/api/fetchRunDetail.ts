import { getValidAccessToken } from "@/lib/db/strava-connection";
import { upsertFitDetail, getFitDetailForUser } from "@/lib/db/activity-streams";
import { fetchActivityLaps, fetchActivityStreams } from "@/lib/strava/api/fetchStreams";
import { mapStravaStreamsToFitDetail } from "@/lib/strava/api/mapToFitDetail";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import {
  fitDetailHasGps,
  fitDetailNeedsGpsRefresh,
  isEmptyFitDetail,
} from "@/lib/strava/fitStreamCompleteness";

/** Load cached stream detail or fetch from Strava and persist. */
export async function loadOrFetchFitDetailForRun(
  userId: string,
  activityId: string,
  options?: { forceRefresh?: boolean },
): Promise<FitRunDetail | null> {
  const cached = await getFitDetailForUser(userId, activityId);
  const id = Number(activityId);
  if (!Number.isFinite(id)) return cached;

  const canUseCache =
    cached &&
    !options?.forceRefresh &&
    !isEmptyFitDetail(cached) &&
    !fitDetailNeedsGpsRefresh(cached);
  if (canUseCache) return cached;

  const { accessToken } = await getValidAccessToken(userId);
  const [streams, laps] = await Promise.all([
    fetchActivityStreams(accessToken, id),
    fetchActivityLaps(accessToken, id),
  ]);

  const detail = mapStravaStreamsToFitDetail(activityId, streams, laps);
  if (!detail) return cached ?? null;

  await upsertFitDetail(userId, id, detail);
  return detail;
}

export { fitDetailHasGps, fitDetailNeedsGpsRefresh, isEmptyFitDetail };
