import type { RunActivity } from "@/lib/strava/types";
import type { FitLap, FitRunDetail } from "@/lib/strava/fitTypes";
import type { WorkoutClassification, WorkoutType } from "@/lib/analytics/workoutType";

/**
 * Workout-quality v2 — execution quality *within* a quality session.
 *
 * Deterministic, pure. Reads lap + stream data (FIT) and the workout
 * classification. Three lenses beyond v1's single quality score:
 *   - interval repeatability: how consistent the work reps were (pace CV)
 *   - aerobic decoupling: pace:HR efficiency drift between halves (NEW)
 *   - threshold control: holding a steady effort on tempo/threshold work
 *
 * Language layers (Coach, run detail) surface these; they must not invent them.
 */

export interface RepSplit {
  index: number;
  distanceM: number | null;
  timeSec: number | null;
  paceSecPerKm: number | null;
  avgHr: number | null;
  /** Pace vs the work-rep median, % (negative = faster than median). */
  paceDeltaPctVsMedian: number | null;
}

export interface WorkoutQuality {
  type: WorkoutType;
  /** True for structured/sustained efforts where these metrics are meaningful. */
  applicable: boolean;
  reps: RepSplit[];
  /** 0–100 from work-rep pace CV; null if fewer than 2 work reps. */
  repeatabilityScore: number | null;
  /** Work-rep pace coefficient of variation, as a %. */
  paceCvPct: number | null;
  /** Aerobic decoupling %: efficiency (speed/HR) drop from first to second half. */
  decouplingPct: number | null;
  /** 0–100 for sustained tempo/threshold efforts; null otherwise. */
  thresholdControlScore: number | null;
  confidence: "low" | "medium" | "high";
  evidence: string[];
  limitations: string[];
}

const SUSTAINED: ReadonlySet<WorkoutType> = new Set(["tempo", "race", "long"]);

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function cv(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs);
  if (m === 0) return null;
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance) / m;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Work reps = the efforts that carry the session's intent.
 * Intervals: laps meaningfully faster than the median (recovery jogs excluded).
 * Sustained efforts: all laps, minus an obvious warm-up/cool-down (>12% slower).
 */
function selectWorkLaps(laps: FitLap[], type: WorkoutType): FitLap[] {
  const valid = laps.filter((l) => l.avgPaceSecPerKm != null && l.avgPaceSecPerKm > 0);
  if (valid.length === 0) return [];
  const paces = valid.map((l) => l.avgPaceSecPerKm!);
  if (type === "interval") {
    // Work reps sit near the fastest paces; recovery jogs near the slowest.
    // Split at the midpoint between fastest and slowest — robust to the median
    // landing on the work pace when reps outnumber (or match) recoveries.
    const min = Math.min(...paces);
    const max = Math.max(...paces);
    const midpoint = (min + max) / 2;
    return valid.filter((l) => l.avgPaceSecPerKm! <= midpoint);
  }
  // Sustained: drop warm-up/cool-down laps that are much slower than the median.
  const med = median(paces);
  return valid.filter((l) => l.avgPaceSecPerKm! <= med * 1.12);
}

/** Average of a stream slice's valid values via the accessor. */
function avgOf<T>(items: T[], get: (t: T) => number | null | undefined): number | null {
  const vals = items.map(get).filter((v): v is number => typeof v === "number" && v > 0);
  return vals.length > 0 ? mean(vals) : null;
}

function splitByHalf<T extends { elapsedSec: number }>(stream: T[]): [T[], T[]] {
  const sorted = [...stream].sort((a, b) => a.elapsedSec - b.elapsedSec);
  const maxT = sorted[sorted.length - 1]?.elapsedSec ?? 0;
  const mid = maxT / 2;
  return [sorted.filter((p) => p.elapsedSec <= mid), sorted.filter((p) => p.elapsedSec > mid)];
}

/**
 * Aerobic decoupling: efficiency = speed / HR = (1 / pace) / HR. If the second
 * half's efficiency has dropped (HR crept up for the same pace), decoupling is
 * positive. The classic aerobic-durability signal, absent from v1.
 */
function computeDecouplingPct(fit: FitRunDetail): number | null {
  if (fit.paceStream.length < 10 || fit.hrStream.length < 10) return null;
  const [p1, p2] = splitByHalf(fit.paceStream);
  const [h1, h2] = splitByHalf(fit.hrStream);
  if (p1.length < 3 || p2.length < 3 || h1.length < 3 || h2.length < 3) return null;

  const pace1 = avgOf(p1, (p) => p.paceSecPerKm);
  const pace2 = avgOf(p2, (p) => p.paceSecPerKm);
  const hr1 = avgOf(h1, (h) => h.hr);
  const hr2 = avgOf(h2, (h) => h.hr);
  if (!pace1 || !pace2 || !hr1 || !hr2) return null;

  const eff1 = 1 / pace1 / hr1;
  const eff2 = 1 / pace2 / hr2;
  if (eff1 <= 0) return null;
  return Math.round(((eff1 - eff2) / eff1) * 1000) / 10;
}

export function computeWorkoutQuality(
  run: RunActivity,
  fit: FitRunDetail | null,
  workout: WorkoutClassification,
): WorkoutQuality {
  const type = workout.type;
  const applicable = type === "interval" || SUSTAINED.has(type);
  const evidence: string[] = [];
  const limitations: string[] = [];

  const laps = fit?.laps ?? [];
  const workLaps = selectWorkLaps(laps, type);
  const workPaces = workLaps
    .map((l) => l.avgPaceSecPerKm)
    .filter((p): p is number => p != null && p > 0);
  const med = workPaces.length > 0 ? median(workPaces) : null;

  const reps: RepSplit[] = workLaps.map((l, i) => ({
    index: i + 1,
    distanceM: l.distanceM,
    timeSec: l.timeSec,
    paceSecPerKm: l.avgPaceSecPerKm,
    avgHr: l.avgHr,
    paceDeltaPctVsMedian:
      med && l.avgPaceSecPerKm ? Math.round(((l.avgPaceSecPerKm - med) / med) * 1000) / 10 : null,
  }));

  const paceCvRaw = cv(workPaces);
  const paceCvPct = paceCvRaw != null ? Math.round(paceCvRaw * 1000) / 10 : null;
  const repeatabilityScore =
    paceCvRaw != null && workPaces.length >= 2
      ? Math.round(clamp(100 - paceCvRaw * 400, 0, 100))
      : null;

  const decouplingPct = fit ? computeDecouplingPct(fit) : null;

  // Threshold control: sustained efforts only — reward steady pace + low decoupling.
  let thresholdControlScore: number | null = null;
  if (SUSTAINED.has(type) && (repeatabilityScore != null || decouplingPct != null)) {
    const paceComponent = repeatabilityScore ?? 60;
    const decoupPenalty = decouplingPct != null ? Math.max(0, decouplingPct) * 6 : 0;
    thresholdControlScore = Math.round(clamp(paceComponent - decoupPenalty, 0, 100));
  }

  // Evidence / limitations.
  if (repeatabilityScore != null) {
    evidence.push(
      `${workLaps.length} work rep${workLaps.length === 1 ? "" : "s"}, pace CV ${paceCvPct}%`,
    );
  }
  if (decouplingPct != null) {
    evidence.push(`Aerobic decoupling ${decouplingPct > 0 ? "+" : ""}${decouplingPct}%`);
  }
  if (!fit) {
    limitations.push("No FIT lap/stream data — quality metrics require synced streams.");
  } else {
    if (laps.length < 2)
      limitations.push("Fewer than 2 laps recorded — repeatability unavailable.");
    if (decouplingPct == null)
      limitations.push("Pace or HR stream too sparse for aerobic decoupling.");
  }

  const hasLaps = laps.length >= 2;
  const hasStreams = decouplingPct != null;
  const confidence: WorkoutQuality["confidence"] =
    hasLaps && hasStreams ? "high" : hasLaps || hasStreams ? "medium" : "low";

  return {
    type,
    applicable,
    reps,
    repeatabilityScore,
    paceCvPct,
    decouplingPct,
    thresholdControlScore,
    confidence,
    evidence,
    limitations,
  };
}
