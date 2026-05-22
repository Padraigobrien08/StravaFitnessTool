/** Subset of Strava API v3 activity + athlete shapes used for mapping. */

export interface StravaAthlete {
  id: number;
  firstname?: string;
  lastname?: string;
  max_heartrate?: number | null;
  measurement_preference?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  /** @deprecated Prefer sport_type */
  type: string;
  /** Canonical activity classifier (Strava API v3) */
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  start_date: string;
  start_date_local?: string;
  trainer?: boolean;
  commute?: boolean;
  average_speed?: number | null;
  max_speed?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_watts?: number | null;
  weighted_average_watts?: number | null;
  total_elevation_gain?: number | null;
  calories?: number | null;
  suffer_score?: number | null;
  average_cadence?: number | null;
  description?: string | null;
}

export interface StravaTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  /** Present on authorization_code exchange; omitted on refresh_token grant */
  athlete?: StravaAthlete;
}

export interface StravaStreamSeries {
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
}

export type StravaStreamSet = Record<string, StravaStreamSeries>;

export interface StravaLap {
  id?: number;
  lap_index: number;
  distance: number;
  elapsed_time: number;
  moving_time?: number;
  average_speed?: number | null;
  average_heartrate?: number | null;
  average_cadence?: number | null;
}
