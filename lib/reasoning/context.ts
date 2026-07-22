import type { AthleteIntelligenceBundle } from "@/lib/intelligence/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { RunActivity } from "@/lib/strava/types";
import type { ReasoningContext } from "./types";

export function buildReasoningContext(
  bundle: AthleteIntelligenceBundle,
  raceGoal: RaceGoal | null,
): ReasoningContext {
  const fitDetails = bundle.fitDetails ?? [];
  const runs = bundle.runs ?? [];
  const fitByRunId = new Map(fitDetails.map((f) => [f.activityId, f]));
  const labelByRunId = new Map(
    bundle.analytics.workoutLabels.map((l) => [l.runId, l.classification]),
  );

  return {
    runs: [...runs].sort((a, b) => a.date.localeCompare(b.date)),
    fitByRunId,
    labelByRunId,
    analytics: bundle.analytics,
    quality: bundle.quality,
    raceGoal,
  };
}

/** For unit tests with explicit runs. */
export function buildTestReasoningContext(
  runs: RunActivity[],
  fitDetails: FitRunDetail[],
  bundle: AthleteIntelligenceBundle,
  raceGoal: RaceGoal | null,
): ReasoningContext {
  return {
    runs: [...runs].sort((a, b) => a.date.localeCompare(b.date)),
    fitByRunId: new Map(fitDetails.map((f) => [f.activityId, f])),
    labelByRunId: new Map(bundle.analytics.workoutLabels.map((l) => [l.runId, l.classification])),
    analytics: bundle.analytics,
    quality: bundle.quality,
    raceGoal,
  };
}
