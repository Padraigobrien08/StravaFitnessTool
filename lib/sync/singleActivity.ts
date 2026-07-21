import { upsertActivities } from "@/lib/db/activities";
import { upsertFitDetail } from "@/lib/db/activity-streams";
import { getValidAccessToken } from "@/lib/db/strava-connection";
import type { StravaActivity } from "@/lib/strava/api/types";
import {
  fetchActivityLaps,
  fetchActivityStreams,
} from "@/lib/strava/api/fetchStreams";
import { mapStravaStreamsToFitDetail } from "@/lib/strava/api/mapToFitDetail";
import { stravaGet } from "@/lib/strava/api/client";

export async function fetchActivityById(
  accessToken: string,
  activityId: number
): Promise<StravaActivity | null> {
  // Routed through the shared client so the request URL is validated against
  // Strava's origin (guards the bearer token against SSRF).
  return stravaGet<StravaActivity>(
    accessToken,
    `/activities/${activityId}`,
    undefined,
    { allow404: true, context: `Strava activity ${activityId}` }
  );
}

export async function syncSingleActivityForUser(
  userId: string,
  activityId: number
): Promise<{ ok: boolean; sport?: string }> {
  const { accessToken } = await getValidAccessToken(userId);
  const activity = await fetchActivityById(accessToken, activityId);
  if (!activity) return { ok: false };

  const sport = activity.sport_type || activity.type;
  await upsertActivities(userId, [activity]);

  if (sport === "Run") {
    const [streams, laps] = await Promise.all([
      fetchActivityStreams(accessToken, activityId),
      fetchActivityLaps(accessToken, activityId),
    ]);
    const detail = mapStravaStreamsToFitDetail(
      String(activityId),
      streams,
      laps
    );
    if (detail) {
      await upsertFitDetail(userId, activityId, detail);
    }
  }

  return { ok: true, sport };
}

export async function deleteActivityForUser(
  userId: string,
  activityId: number
): Promise<void> {
  const sql = (await import("@/lib/db/client")).getSql();
  await sql`
    DELETE FROM activity_streams
    WHERE user_id = ${userId}::uuid AND strava_activity_id = ${activityId}
  `;
  await sql`
    DELETE FROM activities
    WHERE user_id = ${userId}::uuid AND strava_activity_id = ${activityId}
  `;
}
