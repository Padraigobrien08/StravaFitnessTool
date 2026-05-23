import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import type { WorkoutClassification } from "@/lib/analytics/workoutType";
import type { DashboardInsights } from "@/lib/analytics";
import { paceSecPerKm } from "@/lib/analytics/pace";
import { evaluateSessionExecution } from "@/lib/session-intelligence";
import {
  computeLateFadePct,
  scoreSessionExecution,
} from "@/lib/reasoning/executionScore";
import type { RunActivity } from "@/lib/strava/types";
import type { FitLap, FitRunDetail } from "@/lib/strava/fitTypes";
import { formatPace } from "@/lib/utils";
import type { RunCoachDetail } from "./types";

const UNKNOWN_WORKOUT: WorkoutClassification = {
  type: "unknown",
  confidence: "low",
  signals: [],
};

function workoutForRun(
  analytics: DashboardInsights,
  runId: string
): WorkoutClassification {
  return (
    analytics.workoutLabels.find((l) => l.runId === runId)?.classification ??
    UNKNOWN_WORKOUT
  );
}

function formatLapSummary(laps: FitLap[], max = 6): string | undefined {
  if (!laps.length) return undefined;
  const parts = laps.slice(0, max).map((lap, i) => {
    const km =
      lap.distanceM != null
        ? `${(lap.distanceM / 1000).toFixed(2)}km`
        : "?km";
    const pace =
      lap.avgPaceSecPerKm != null ? formatPace(lap.avgPaceSecPerKm) : "—";
    const hr = lap.avgHr != null ? ` HR${lap.avgHr}` : "";
    return `L${i + 1}:${km}@${pace}/km${hr}`;
  });
  if (laps.length > max) {
    parts.push(`+${laps.length - max} more laps`);
  }
  return parts.join("; ");
}

function streamFlags(fit: FitRunDetail | null): string {
  if (!fit) return "summary only (no FIT/stream)";
  const flags: string[] = [];
  if (fit.paceStream.length >= 12) flags.push("pace");
  if (fit.hrStream.length >= 12) flags.push("HR");
  if ((fit.gpsStream?.length ?? 0) >= 2) flags.push("GPS");
  if (fit.laps.length > 0) flags.push(`${fit.laps.length} laps`);
  return flags.length ? flags.join(", ") : "FIT parsed, limited streams";
}

export function buildRunCoachDetail(
  run: RunActivity,
  fit: FitRunDetail | null,
  analytics: DashboardInsights,
  historicalRuns: RunActivity[] = []
): RunCoachDetail {
  const workout = workoutForRun(analytics, run.id);
  const session = evaluateSessionExecution(run, fit, workout, {
    analytics,
    historicalRuns: historicalRuns.filter((r) => r.date < run.date),
  });
  const scored = scoreSessionExecution(run, fit, workout);
  const lateFade = computeLateFadePct(fit);
  const pace = paceSecPerKm(run);

  return {
    runId: run.id,
    date: run.date.slice(0, 10),
    name: run.name,
    workoutType: workout.type,
    workoutTypeLabel:
      WORKOUT_TYPE_LABELS[workout.type] ?? workout.type,
    distanceKm: Math.round((run.distanceM / 1000) * 10) / 10,
    durationMin: Math.round(run.movingSec / 60),
    pace: pace ? formatPace(pace) : null,
    avgHr: run.avgHr,
    maxHr: run.maxHr,
    elevationGainM: run.elevationGainM,
    trainingLoad: run.trainingLoad,
    gradeAdjustedPace:
      run.gradeAdjustedPaceSecPerKm != null
        ? formatPace(run.gradeAdjustedPaceSecPerKm)
        : null,
    streams: streamFlags(fit),
    lapCount: fit?.laps.length ?? 0,
    lapSummary: fit?.laps.length ? formatLapSummary(fit.laps) : undefined,
    hrDriftPct: fit?.hrDriftPct ?? scored.hrDriftPct,
    lateFadePct: lateFade,
    executionQuality: session.executionQuality,
    executionScore: scored.qualityScore,
    fatigueCost: session.fatigueCost,
    goalAlignment: session.goalAlignment,
    pacingAssessment: session.pacingAssessment,
    hrAssessment: session.hrAssessment,
    historicalComparison: session.historicalComparison,
    likelyAdaptations: session.likelyAdaptations,
    narrative: session.narrative,
    evidence: session.evidence.slice(0, 5),
  };
}
