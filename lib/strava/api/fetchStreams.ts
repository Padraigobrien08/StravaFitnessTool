import { stravaGet } from "./client";
import type { StravaLap, StravaStreamSet } from "./types";

export const STREAM_KEYS =
  "time,distance,heartrate,velocity_smooth,cadence,latlng,altitude,watts,temp,grade_smooth";

export async function fetchActivityLaps(
  accessToken: string,
  activityId: number,
): Promise<StravaLap[]> {
  const data = await stravaGet<StravaLap[]>(
    accessToken,
    `/activities/${activityId}/laps`,
    undefined,
    { allow404: true, context: `laps ${activityId}` },
  );
  return data ?? [];
}

export async function fetchActivityStreams(
  accessToken: string,
  activityId: number,
  keys: string = STREAM_KEYS,
): Promise<StravaStreamSet | null> {
  const data = await stravaGet<StravaStreamSet>(
    accessToken,
    `/activities/${activityId}/streams`,
    { keys, key_by_type: "true" },
    { allow404: true, context: `streams ${activityId}` },
  );
  return data;
}
