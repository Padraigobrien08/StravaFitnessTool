import { upsertActivities } from "@/lib/db/activities";
import { upsertFitDetail } from "@/lib/db/activity-streams";
import { getValidAccessToken } from "@/lib/db/strava-connection";
import type { StravaActivity } from "@/lib/strava/api/types";
import {
  fetchActivityLaps,
  fetchActivityStreams,
} from "@/lib/strava/api/fetchStreams";
import { mapStravaStreamsToFitDetail } from "@/lib/strava/api/mapToFitDetail";
import { STRAVA_API_BASE } from "@/lib/strava/api/config";

export async function fetchActivityById(
  accessToken: string,
  activityId: number
): Promise<StravaActivity | null> {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava activity ${activityId}: ${res.status} ${text}`);
  }
  return res.json() as Promise<StravaActivity>;
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
