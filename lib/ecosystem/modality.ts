import type { ActivityModality } from "./types";

/**
 * Strava API v3 sport_type → internal modality.
 * Single source of truth — do not scatter sport_type conditionals elsewhere.
 * @see https://developers.strava.com/docs/reference/#api-models-SportType
 */
const SPORT_TO_MODALITY: Record<string, ActivityModality> = {
  Run: "run",
  TrailRun: "run",
  VirtualRun: "run",
  Walk: "recovery",
  Ride: "bike",
  VirtualRide: "bike",
  GravelRide: "bike",
  MountainBikeRide: "bike",
  EMountainBikeRide: "bike",
  EBikeRide: "bike",
  Handcycle: "bike",
  Velomobile: "bike",
  Swim: "swim",
  Rowing: "aerobic_cross_training",
  VirtualRow: "aerobic_cross_training",
  Elliptical: "aerobic_cross_training",
  StairStepper: "aerobic_cross_training",
  WeightTraining: "strength",
  Workout: "unknown",
  HighIntensityIntervalTraining: "high_intensity_cross_training",
  Crossfit: "high_intensity_cross_training",
  Yoga: "mobility",
  Pilates: "mobility",
  PhysicalTherapy: "mobility",
  Hike: "outdoor_endurance",
  NordicSki: "outdoor_endurance",
  BackcountrySki: "outdoor_endurance",
  Snowshoe: "outdoor_endurance",
  AlpineSki: "outdoor_endurance",
  RollerSki: "outdoor_endurance",
  Soccer: "sport",
  Tennis: "sport",
  Basketball: "sport",
  Volleyball: "sport",
  Padel: "sport",
  Pickleball: "sport",
  Squash: "sport",
  Racquetball: "sport",
  TableTennis: "sport",
  Golf: "sport",
  Dance: "sport",
  Badminton: "sport",
  IceSkate: "sport",
  InlineSkate: "sport",
  Skateboard: "sport",
  Surfing: "sport",
  Windsurf: "sport",
  Kitesurf: "sport",
  RockClimbing: "strength",
  Canoeing: "aerobic_cross_training",
  Kayaking: "aerobic_cross_training",
  StandUpPaddling: "aerobic_cross_training",
  Wheelchair: "aerobic_cross_training",
};

/** CSV export labels → Strava sport_type */
const CSV_ALIASES: Record<string, string> = {
  "Trail Run": "TrailRun",
  "Virtual Run": "VirtualRun",
  "Virtual Ride": "VirtualRide",
  "Weight Training": "WeightTraining",
  "High Intensity Interval Training": "HighIntensityIntervalTraining",
  "Stair Stepper": "StairStepper",
  "Physical Therapy": "PhysicalTherapy",
  "Gravel Ride": "GravelRide",
  "Mountain Bike Ride": "MountainBikeRide",
  "E-Bike Ride": "EBikeRide",
  "Nordic Ski": "NordicSki",
};

export function normalizeSportType(sportType: string): string {
  const raw = sportType?.trim();
  if (!raw) return "";
  return CSV_ALIASES[raw] ?? raw;
}

export function classifyActivityModality(sportType: string): ActivityModality {
  const key = normalizeSportType(sportType);
  if (!key) return "unknown";
  if (SPORT_TO_MODALITY[key]) return SPORT_TO_MODALITY[key];
  const lower = key.toLowerCase();
  if (lower.includes("run")) return "run";
  if (lower.includes("swim")) return "swim";
  if (lower.includes("ride") || lower.includes("bike") || lower.includes("cycle")) {
    return "bike";
  }
  if (lower.includes("weight") || lower.includes("strength")) return "strength";
  if (lower.includes("yoga") || lower.includes("pilates")) return "mobility";
  if (lower.includes("hiit") || lower.includes("crossfit")) {
    return "high_intensity_cross_training";
  }
  if (lower.includes("hike") || lower.includes("ski")) return "outdoor_endurance";
  return "unknown";
}

export function isRunSportType(sportType: string): boolean {
  return classifyActivityModality(sportType) === "run";
}

/** Aerobic support modalities (non-run, non-HIIT) */
export function isAerobicSupportModality(m: ActivityModality): boolean {
  return (
    m === "bike" ||
    m === "swim" ||
    m === "aerobic_cross_training" ||
    m === "outdoor_endurance"
  );
}

export function isHighIntensityModality(
  a: Pick<{ modality: ActivityModality; perceivedIntensity: string }, "modality" | "perceivedIntensity">
): boolean {
  return (
    a.modality === "high_intensity_cross_training" ||
    a.modality === "sport" ||
    (a.modality === "strength" && a.perceivedIntensity === "high") ||
    (a.modality === "run" && a.perceivedIntensity === "high")
  );
}

export function modalityLabel(m: ActivityModality): string {
  const labels: Record<ActivityModality, string> = {
    run: "Run",
    bike: "Bike",
    swim: "Swim",
    aerobic_cross_training: "Aerobic cross-training",
    strength: "Strength",
    mobility: "Mobility",
    recovery: "Recovery movement",
    high_intensity_cross_training: "HIIT / CrossFit",
    sport: "Sport",
    outdoor_endurance: "Outdoor endurance",
    unknown: "Unclassified",
  };
  return labels[m];
}

export function registerSportTypeMapping(
  sportType: string,
  modality: ActivityModality
): void {
  SPORT_TO_MODALITY[normalizeSportType(sportType)] = modality;
}
