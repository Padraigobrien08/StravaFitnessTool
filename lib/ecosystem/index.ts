export * from "./types";
export * from "./modality";
export * from "./intensity";
export * from "./normalize";
export * from "./aggregates";
export * from "./archetype";
export * from "./interference";
export * from "./scoring";
export { buildEcosystemInsightList } from "./insightGenerators";
export * from "./engine";
export * from "./insights";
export * from "./coachTools";
export * from "./coverage";

import type { StravaImport } from "@/lib/strava/types";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { RunWorkoutLabel } from "@/lib/analytics/workoutType";
import { buildTrainingEcosystem } from "./engine";
import { normalizeActivitiesFromImport } from "./normalize";
import type { ActivitySource, TrainingEcosystemAnalysis } from "./types";

export function computeTrainingEcosystem(
  data: StravaImport,
  workoutLabels: RunWorkoutLabel[],
  dataConfidence: "low" | "medium" | "high",
  raceGoal: RaceGoal | null = null,
  source: ActivitySource = "strava_api"
): TrainingEcosystemAnalysis {
  const activities = normalizeActivitiesFromImport(
    data,
    workoutLabels,
    data.fitRunIds ?? [],
    source
  );
  return buildTrainingEcosystem(activities, raceGoal, dataConfidence);
}
