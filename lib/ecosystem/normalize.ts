import type { StravaImport } from "@/lib/strava/types";
import type { RunActivity, ActivitySummary } from "@/lib/strava/types";
import type { RunWorkoutLabel } from "@/lib/analytics/workoutType";
import { classifyActivityModality, isRunSportType, normalizeSportType } from "./modality";
import { inferActivityIntensity, inferActivityPurpose } from "./intensity";
import type { ActivitySource, NormalizedActivity } from "./types";

const HARD_RUN_TYPES = new Set(["tempo", "interval", "race"]);

function activityConfidence(
  a: Pick<NormalizedActivity, "avgHr" | "hasStreams" | "modality">
): "low" | "medium" | "high" {
  if (a.hasStreams && a.avgHr != null) return "high";
  if (a.avgHr != null || a.modality === "run") return "medium";
  return "low";
}

function summaryToNormalized(
  a: ActivitySummary,
  source: ActivitySource,
  hasStreams: boolean,
  athleteMaxHr: number,
  isHardRun?: boolean
): NormalizedActivity {
  const sportType = normalizeSportType(a.type);
  const modality = classifyActivityModality(sportType);
  const movingSec = a.movingSec ?? a.elapsedSec;
  const base: NormalizedActivity = {
    id: a.id,
    source,
    sportType,
    modality,
    name: a.name,
    startDate: a.date,
    startDateLocal: a.startDateLocal,
    movingTimeSec: movingSec,
    elapsedTimeSec: a.elapsedSec,
    distanceMeters: a.distanceM > 0 ? a.distanceM : undefined,
    avgHr: a.avgHr ?? undefined,
    maxHr: a.maxHr ?? undefined,
    calories: a.calories ?? undefined,
    elevationGainMeters: a.elevationGainM ?? undefined,
    cadence: a.avgCadence ?? undefined,
    power: a.avgWatts ?? undefined,
    trainer: a.trainer,
    commute: a.commute,
    hasStreams,
    hasLaps: a.hasLaps ?? false,
    perceivedIntensity: "moderate",
    intensity: { level: "moderate", confidence: "low", evidence: [] },
    isHardRun,
    confidence: "low",
  };
  base.intensity = inferActivityIntensity(base, athleteMaxHr);
  base.perceivedIntensity =
    base.intensity.level === "unknown" ? "moderate" : base.intensity.level;
  base.inferredPurpose = inferActivityPurpose(base);
  base.confidence = activityConfidence(base);
  return base;
}

function runToNormalized(
  r: RunActivity,
  label: RunWorkoutLabel | undefined,
  source: ActivitySource,
  hasStreams: boolean,
  athleteMaxHr: number,
  sportType = "Run"
): NormalizedActivity {
  const isHard = label ? HARD_RUN_TYPES.has(label.classification.type) : false;
  const isLong = (r.distanceM ?? 0) / 1000 >= 16;
  const base: NormalizedActivity = {
    id: r.id,
    source,
    sportType: normalizeSportType(sportType),
    modality: "run",
    name: r.name,
    startDate: r.date,
    movingTimeSec: r.movingSec || r.elapsedSec,
    elapsedTimeSec: r.elapsedSec,
    distanceMeters: r.distanceM,
    avgHr: r.avgHr ?? undefined,
    maxHr: r.maxHr ?? undefined,
    calories: r.calories ?? undefined,
    elevationGainMeters: r.elevationGainM ?? undefined,
    cadence: r.avgCadence ?? undefined,
    hasStreams,
    hasLaps: false,
    perceivedIntensity: "moderate",
    intensity: { level: "moderate", confidence: "low", evidence: [] },
    isHardRun: isHard || isLong,
    confidence: "medium",
  };
  base.intensity = inferActivityIntensity(base, athleteMaxHr);
  base.perceivedIntensity =
    base.intensity.level === "unknown" ? "moderate" : base.intensity.level;
  base.inferredPurpose = inferActivityPurpose(base);
  base.confidence = activityConfidence(base);
  return base;
}

export function normalizeActivitiesFromImport(
  data: StravaImport,
  workoutLabels: RunWorkoutLabel[],
  fitRunIds: string[] = [],
  source: ActivitySource = "strava_export"
): NormalizedActivity[] {
  const athleteMaxHr = data.profile.maxHeartRate ?? 190;
  const labelById = new Map(workoutLabels.map((l) => [l.runId, l]));
  const fitSet = new Set(fitRunIds);
  const runIds = new Set(data.runs.map((r) => r.id));

  const out: NormalizedActivity[] = [];

  for (const r of data.runs) {
    const sport =
      data.allActivities.find((a) => a.id === r.id)?.type ?? "Run";
    out.push(
      runToNormalized(
        r,
        labelById.get(r.id),
        source,
        fitSet.has(r.id),
        athleteMaxHr,
        sport
      )
    );
  }

  for (const a of data.allActivities) {
    if (runIds.has(a.id)) continue;
    const sportType = normalizeSportType(a.type);
    if (isRunSportType(sportType)) continue;
    out.push(summaryToNormalized(a, source, false, athleteMaxHr));
  }

  return out.sort(
    (x, y) => new Date(x.startDate).getTime() - new Date(y.startDate).getTime()
  );
}
