import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail, FitLap } from "@/lib/strava/fitTypes";
import { parseISO, subDays } from "date-fns";

export type WorkoutType =
  | "easy"
  | "recovery"
  | "tempo"
  | "interval"
  | "long"
  | "race"
  | "unknown";

export interface WorkoutClassification {
  type: WorkoutType;
  confidence: "low" | "medium" | "high";
  signals: string[];
}

export interface RunWorkoutLabel {
  runId: string;
  date: string;
  runName: string;
  classification: WorkoutClassification;
}

export interface WorkoutTypeBucket {
  type: WorkoutType;
  label: string;
  runCount: number;
  pct: number;
}

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  easy: "Easy",
  recovery: "Recovery",
  tempo: "Tempo",
  interval: "Interval",
  long: "Long run",
  race: "Race",
  unknown: "Unknown",
};

const NAME_PATTERNS: { type: WorkoutType; re: RegExp }[] = [
  {
    type: "interval",
    re: /\b(intervals?|fartlek|repeat|repeats|\d+\s*x\s*\d+)\b/i,
  },
  { type: "tempo", re: /\b(tempo|threshold|cruise|lt)\b/i },
  { type: "long", re: /\b(long run|lsd|endurance run)\b/i },
  { type: "race", re: /\b(race|parkrun|park run|5k race|10k race|marathon)\b/i },
  { type: "recovery", re: /\b(recovery|shakeout|shake out)\b/i },
  { type: "easy", re: /\b(easy run|recovery jog|aerobic)\b/i },
];

function nameHint(name: string): { type: WorkoutType; signal: string } | null {
  for (const { type, re } of NAME_PATTERNS) {
    if (re.test(name)) {
      return { type, signal: `Title suggests ${WORKOUT_TYPE_LABELS[type].toLowerCase()}` };
    }
  }
  return null;
}

function lapPaceCv(laps: FitLap[]): number | null {
  const paces = laps
    .map((l) => l.avgPaceSecPerKm)
    .filter((p): p is number => p !== null && p > 0);
  if (paces.length < 4) return null;
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  if (mean === 0) return null;
  const variance =
    paces.reduce((s, p) => s + (p - mean) ** 2, 0) / paces.length;
  return Math.sqrt(variance) / mean;
}

export function isIntervalFromLaps(laps: FitLap[]): boolean {
  const cv = lapPaceCv(laps);
  return cv !== null && cv > 0.15;
}

export function classifyRun(
  run: RunActivity,
  athleteMaxHr: number,
  fit: FitRunDetail | undefined,
  previousRunWasHard: boolean
): WorkoutClassification {
  const signals: string[] = [];
  const km = run.distanceM / 1000;
  const hint = nameHint(run.name);

  if (hint) signals.push(hint.signal);

  const hrPct =
    run.avgHr !== null && athleteMaxHr > 0
      ? run.avgHr / athleteMaxHr
      : null;

  if (hrPct !== null) {
    signals.push(`Avg HR ${Math.round(hrPct * 100)}% of max`);
  }

  // Strong name hints
  if (hint?.type === "race") {
    return { type: "race", confidence: "high", signals };
  }
  if (hint?.type === "interval" && (fit?.laps.length ?? 0) >= 3) {
    return { type: "interval", confidence: "high", signals };
  }

  // FIT lap interval pattern
  if (fit && fit.laps.length >= 4 && isIntervalFromLaps(fit.laps)) {
    signals.push(
      `Lap pace variability (CV ${((lapPaceCv(fit.laps) ?? 0) * 100).toFixed(0)}%)`
    );
    return { type: "interval", confidence: "high", signals };
  }

  // Long run by distance
  if (km >= 18 && (hrPct === null || hrPct < 0.88)) {
    if (hint?.type !== "interval") {
      signals.push(`Distance ${km.toFixed(1)} km`);
      return {
        type: "long",
        confidence: hrPct !== null ? "high" : "medium",
        signals,
      };
    }
  }

  // Recovery: short + easy after hard day
  if (
    km < 6 &&
    hrPct !== null &&
    hrPct < 0.75 &&
    previousRunWasHard
  ) {
    signals.push("Short easy run after a hard session");
    return { type: "recovery", confidence: "medium", signals };
  }

  if (hint?.type === "recovery") {
    return { type: "recovery", confidence: "medium", signals };
  }

  if (hint?.type === "tempo") {
    return { type: "tempo", confidence: "medium", signals };
  }

  if (hint?.type === "long") {
    return { type: "long", confidence: "medium", signals };
  }

  if (hint?.type === "interval") {
    return { type: "interval", confidence: "medium", signals };
  }

  // HR-based
  if (hrPct !== null) {
    if (hrPct < 0.75) {
      return { type: "easy", confidence: hint ? "medium" : "high", signals };
    }
    if (hrPct < 0.85) {
      return { type: "tempo", confidence: "medium", signals };
    }
    return { type: "tempo", confidence: "medium", signals };
  }

  // No HR — name or distance only
  if (hint?.type === "easy") {
    return { type: "easy", confidence: "low", signals };
  }
  if (km >= 18) {
    signals.push(`Distance ${km.toFixed(1)} km (no HR)`);
    return { type: "long", confidence: "low", signals };
  }

  signals.push("Insufficient HR or title cues");
  return { type: "unknown", confidence: "low", signals };
}

export function classifyAllRuns(
  runs: RunActivity[],
  fitDetails: FitRunDetail[],
  athleteMaxHr: number
): RunWorkoutLabel[] {
  const fitById = new Map(fitDetails.map((f) => [f.activityId, f]));
  const sorted = [...runs].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  const labels: RunWorkoutLabel[] = [];
  let prevHard = false;

  for (const run of sorted) {
    const fit = fitById.get(run.id);
    const classification = classifyRun(run, athleteMaxHr, fit, prevHard);
    labels.push({
      runId: run.id,
      date: run.date,
      runName: run.name,
      classification,
    });
    const hrPct =
      run.avgHr !== null && athleteMaxHr > 0
        ? run.avgHr / athleteMaxHr
        : null;
    prevHard =
      classification.type === "interval" ||
      classification.type === "tempo" ||
      classification.type === "race" ||
      (hrPct !== null && hrPct >= 0.8);
  }

  return labels;
}

export function workoutTypeDistribution(
  labels: RunWorkoutLabel[],
  withinDays = 56
): WorkoutTypeBucket[] {
  const cutoff = subDays(new Date(), withinDays);
  const recent = labels.filter((l) => parseISO(l.date) >= cutoff);
  const total = recent.length;
  const counts = new Map<WorkoutType, number>();

  for (const l of recent) {
    counts.set(
      l.classification.type,
      (counts.get(l.classification.type) ?? 0) + 1
    );
  }

  const order: WorkoutType[] = [
    "easy",
    "recovery",
    "long",
    "tempo",
    "interval",
    "race",
    "unknown",
  ];

  return order
    .filter((t) => (counts.get(t) ?? 0) > 0)
    .map((type) => {
      const runCount = counts.get(type) ?? 0;
      return {
        type,
        label: WORKOUT_TYPE_LABELS[type],
        runCount,
        pct: total > 0 ? (runCount / total) * 100 : 0,
      };
    });
}

export function workoutLabelsByRunId(
  labels: RunWorkoutLabel[]
): Map<string, WorkoutClassification> {
  return new Map(labels.map((l) => [l.runId, l.classification]));
}
