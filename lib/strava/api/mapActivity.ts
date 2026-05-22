import type { ActivitySummary, AthleteProfile, RunActivity } from "@/lib/strava/types";
import type { StravaActivity, StravaAthlete } from "./types";

const RUN_SPORT_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export function mapStravaActivityToRun(a: StravaActivity): RunActivity | null {
  const sport = a.sport_type || a.type;
  if (!RUN_SPORT_TYPES.has(sport)) return null;

  return {
    id: String(a.id),
    date: new Date(a.start_date).toISOString(),
    name: a.name?.trim() || "Untitled",
    distanceM: a.distance ?? 0,
    elapsedSec: a.elapsed_time ?? 0,
    movingSec: a.moving_time ?? a.elapsed_time ?? 0,
    avgSpeedMps: a.average_speed ?? null,
    maxSpeedMps: a.max_speed ?? null,
    avgHr: a.average_heartrate ?? null,
    maxHr: a.max_heartrate ?? null,
    elevationGainM: a.total_elevation_gain ?? null,
    calories: a.calories ?? null,
    relativeEffort: a.suffer_score ?? null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: a.average_cadence ?? null,
    totalSteps: null,
    weatherTempC: null,
    description: a.description ?? undefined,
  };
}

export function mapStravaActivityToSummary(a: StravaActivity): ActivitySummary {
  const sportType = a.sport_type || a.type;
  return {
    id: String(a.id),
    date: new Date(a.start_date).toISOString(),
    name: a.name?.trim() || "Untitled",
    type: sportType,
    distanceM: a.distance ?? 0,
    elapsedSec: a.elapsed_time ?? 0,
    movingSec: a.moving_time ?? a.elapsed_time ?? 0,
    startDateLocal: a.start_date_local
      ? new Date(a.start_date_local).toISOString()
      : undefined,
    avgHr: a.average_heartrate ?? null,
    maxHr: a.max_heartrate ?? null,
    calories: a.calories ?? null,
    elevationGainM: a.total_elevation_gain ?? null,
    avgCadence: a.average_cadence ?? null,
    avgWatts: a.weighted_average_watts ?? a.average_watts ?? null,
    trainer: a.trainer,
    commute: a.commute,
  };
}

export function mapAthleteProfile(athlete: StravaAthlete): AthleteProfile {
  return {
    maxHeartRate: athlete.max_heartrate ?? null,
    athleteType: null,
    ftp: null,
    measurementPreference: athlete.measurement_preference ?? null,
  };
}
