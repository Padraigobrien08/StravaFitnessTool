import { STRAVA_API_BASE } from "./config";
import type { StravaLap, StravaStreamSet } from "./types";

const STREAM_KEYS =
  "time,heartrate,velocity_smooth,cadence,latlng,altitude";

export async function fetchActivityLaps(
  accessToken: string,
  activityId: number
): Promise<StravaLap[]> {
  const res = await fetch(
    `${STRAVA_API_BASE}/activities/${activityId}/laps`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava laps ${activityId}: ${res.status} ${text}`);
  }
  return res.json() as Promise<StravaLap[]>;
}

export async function fetchActivityStreams(
  accessToken: string,
  activityId: number
): Promise<StravaStreamSet | null> {
  const params = new URLSearchParams({
    keys: STREAM_KEYS,
    key_by_type: "true",
  });
  const res = await fetch(
    `${STRAVA_API_BASE}/activities/${activityId}/streams?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava streams ${activityId}: ${res.status} ${text}`);
  }
  return res.json() as Promise<StravaStreamSet>;
}
