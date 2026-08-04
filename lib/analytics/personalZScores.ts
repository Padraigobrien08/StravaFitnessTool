import type { RunActivity } from "@/lib/strava/types";
import { paceSecPerKm } from "./pace";
import { WORKOUT_TYPE_LABELS, type RunWorkoutLabel, type WorkoutType } from "./workoutType";

/**
 * D4 — Personal z-scores (Pillar 4, data-scientist rigor).
 *
 * Scores every session against the athlete's OWN distribution *for that workout
 * type* — "this tempo was +1.8σ" means faster-per-HR than their typical tempo,
 * not vs some population table. Two metrics (grade-adjusted pace, and pace/HR
 * efficiency when HR is present), both oriented so a higher σ is always better.
 *
 * The foundational primitive for the rest of Pillar 4: anomaly detection (D3)
 * flags large |z|, and the honest-correlation work (D5) reuses these per-cohort
 * distributions. Glass-box: each z carries its cohort size and confidence; a
 * thin cohort (or no spread) yields a null z rather than a false-precise number.
 */

export interface SessionZScore {
  runId: string;
  date: string;
  runName: string;
  type: WorkoutType;
  typeLabel: string;
  /** Grade-adjusted pace z (higher = faster than the athlete's typical for this type). */
  paceZ: number | null;
  /** Efficiency (pace/HR) z (higher = more efficient than typical); null without HR. */
  efficiencyZ: number | null;
  /** The headline z — efficiency when HR is present, else pace. */
  primaryZ: number | null;
  primaryMetric: "efficiency" | "pace" | null;
  /** Comparable same-type sessions behind the score. */
  cohortSize: number;
  confidence: "low" | "medium" | "high";
  headline: string;
}

export interface PersonalZScores {
  available: boolean;
  /** Recent sessions, newest first (capped). */
  sessions: SessionZScore[];
  standouts: { best: SessionZScore | null; worst: SessionZScore | null };
  evidence: string[];
  limitations: string[];
}

/** Workout types worth scoring (steady/structured efforts with a meaningful cohort). */
const SCORED_TYPES: ReadonlySet<WorkoutType> = new Set([
  "easy",
  "tempo",
  "interval",
  "long",
  "recovery",
  "race",
]);

const MIN_COHORT = 3;
const RECENT_WINDOW_DAYS = 56;
const MAX_SESSIONS = 20;

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function confidenceFor(n: number): "low" | "medium" | "high" {
  if (n >= 10) return "high";
  if (n >= 5) return "medium";
  return "low";
}

function paceOf(run: RunActivity): number | null {
  if (run.gradeAdjustedPaceSecPerKm != null && run.gradeAdjustedPaceSecPerKm > 0) {
    return run.gradeAdjustedPaceSecPerKm;
  }
  return paceSecPerKm(run);
}

function efficiencyOf(run: RunActivity, pace: number | null): number | null {
  if (pace == null || run.avgHr == null || run.avgHr < 80) return null;
  return pace / run.avgHr;
}

/**
 * Z of `value` within its cohort, flipped so lower-is-better metrics (pace,
 * efficiency index) score positive when the session beats the athlete's typical.
 */
function betterZ(value: number, cohort: number[]): number | null {
  if (cohort.length < MIN_COHORT) return null;
  const m = mean(cohort);
  const sd = stdDev(cohort, m);
  if (sd < 1e-6) return null;
  return round2(-((value - m) / sd));
}

function daysAgo(dateIso: string, now: number): number {
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return Infinity;
  return (now - t) / 86_400_000;
}

export function computePersonalZScores(
  runs: RunActivity[],
  workoutLabels: RunWorkoutLabel[],
): PersonalZScores {
  const typeById = new Map(workoutLabels.map((l) => [l.runId, l.classification.type]));

  // Build per-type cohorts of pace and efficiency across all history.
  const paceByType = new Map<WorkoutType, number[]>();
  const effByType = new Map<WorkoutType, number[]>();
  const runMetrics = new Map<string, { pace: number | null; eff: number | null }>();

  for (const run of runs) {
    const type = typeById.get(run.id);
    if (!type || !SCORED_TYPES.has(type)) continue;
    const pace = paceOf(run);
    const eff = efficiencyOf(run, pace);
    runMetrics.set(run.id, { pace, eff });
    if (pace != null) paceByType.set(type, [...(paceByType.get(type) ?? []), pace]);
    if (eff != null) effByType.set(type, [...(effByType.get(type) ?? []), eff]);
  }

  const now = Date.now();
  const scored: SessionZScore[] = [];

  for (const run of runs) {
    const type = typeById.get(run.id);
    if (!type || !SCORED_TYPES.has(type)) continue;
    const metrics = runMetrics.get(run.id);
    if (!metrics) continue;

    const paceCohort = paceByType.get(type) ?? [];
    const effCohort = effByType.get(type) ?? [];
    const paceZ = metrics.pace != null ? betterZ(metrics.pace, paceCohort) : null;
    const efficiencyZ = metrics.eff != null ? betterZ(metrics.eff, effCohort) : null;
    if (paceZ == null && efficiencyZ == null) continue;

    const primaryMetric = efficiencyZ != null ? "efficiency" : "pace";
    const primaryZ = efficiencyZ != null ? efficiencyZ : paceZ;
    const cohortSize = primaryMetric === "efficiency" ? effCohort.length : paceCohort.length;
    const typeLabel = WORKOUT_TYPE_LABELS[type];

    scored.push({
      runId: run.id,
      date: run.date,
      runName: run.name,
      type,
      typeLabel,
      paceZ,
      efficiencyZ,
      primaryZ,
      primaryMetric,
      cohortSize,
      confidence: confidenceFor(cohortSize),
      headline: buildHeadline(typeLabel, primaryZ!, primaryMetric),
    });
  }

  scored.sort((a, b) => b.date.localeCompare(a.date));

  if (scored.length === 0) {
    return {
      available: false,
      sessions: [],
      standouts: { best: null, worst: null },
      evidence: [],
      limitations: [
        `Need at least ${MIN_COHORT} comparable sessions of a workout type to score it against your own distribution.`,
      ],
    };
  }

  // Standouts among recent sessions with a real spread of cohort behind them.
  const recent = scored.filter(
    (s) => daysAgo(s.date, now) <= RECENT_WINDOW_DAYS && s.primaryZ != null,
  );
  const ranked = [...recent].sort((a, b) => (b.primaryZ ?? 0) - (a.primaryZ ?? 0));
  const best = ranked[0] ?? null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const evidence: string[] = [];
  if (best && best.primaryZ! > 0.5) evidence.push(best.headline);
  if (worst && worst.primaryZ! < -0.5 && worst.runId !== best?.runId) evidence.push(worst.headline);

  const limitations: string[] = [];
  const lowCohorts = scored.filter((s) => s.confidence === "low").length;
  if (lowCohorts > 0) {
    limitations.push(
      `${lowCohorts} session${lowCohorts === 1 ? "" : "s"} scored against a small cohort (<5): treat those σ as directional.`,
    );
  }

  return {
    available: true,
    sessions: scored.slice(0, MAX_SESSIONS),
    standouts: { best, worst: worst && worst.runId !== best?.runId ? worst : null },
    evidence,
    limitations,
  };
}

function buildHeadline(typeLabel: string, z: number, metric: "efficiency" | "pace"): string {
  const mag = Math.abs(z);
  const dir = z >= 0 ? "+" : "−";
  const quality =
    mag < 0.5
      ? "right around"
      : mag < 1.5
        ? z >= 0
          ? "better than"
          : "below"
        : z >= 0
          ? "well above"
          : "well below";
  const lens = metric === "efficiency" ? "faster-per-HR" : "faster";
  return `This ${typeLabel.toLowerCase()} was ${dir}${mag.toFixed(1)}σ, ${quality} your typical ${typeLabel.toLowerCase()}${z >= 0.5 ? ` (${lens})` : ""}.`;
}
