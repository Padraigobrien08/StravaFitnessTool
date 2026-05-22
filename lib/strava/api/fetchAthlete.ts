import { STRAVA_API_BASE } from "./config";

export interface ActivityTotal {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
  achievement_count: number;
}

export interface StravaActivityStats {
  recent_run_totals: ActivityTotal;
  ytd_run_totals: ActivityTotal;
  all_run_totals: ActivityTotal;
  biggest_ride_distance?: number;
  biggest_climb_elevation_gain?: number;
}

export interface StravaZoneDistribution {
  min: number;
  max: number;
  time: number;
}

export interface StravaActivityZone {
  type: string;
  max?: number;
  custom_zones?: boolean;
  distribution_buckets?: StravaZoneDistribution[];
}

export async function fetchAthleteStats(
  accessToken: string,
  athleteId: number
): Promise<StravaActivityStats> {
  const res = await fetch(`${STRAVA_API_BASE}/athletes/${athleteId}/stats`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava athlete stats failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<StravaActivityStats>;
}

export async function fetchAthleteZones(
  accessToken: string
): Promise<StravaActivityZone[]> {
  const res = await fetch(`${STRAVA_API_BASE}/athlete/zones`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava athlete zones failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<StravaActivityZone[]>;
}
