import { parseISO, differenceInCalendarDays } from "date-fns";
import {
  DEFAULT_FEEL_CALIBRATION,
  type FeelCalibration,
  type FeelHistoryPoint,
} from "./calibration";

/**
 * Outcome-based recalibration of the leg-feel nudge (P4 + execution-grade refinement).
 *
 * Where P3 used *agreement with the load model* as a proxy for thoughtful
 * reporting (and could only ever amplify), this uses actual results: did a
 * "heavy" report precede a genuinely worse session, and "fresh" a better one?
 * Because that's real evidence — not a proxy — it is **bidirectional**: a
 * reporter whose reads reliably predict how sessions go is trusted more; one
 * whose reads are counter-predictive is trusted less. It stays bounded and
 * floored (a "heavy" report can never be worth less than −6), and is heavily
 * shrunk toward the default on small samples. Below the pair gate it defers to
 * the P3 result (which itself defers to the flat default).
 *
 * The outcome signal is a ladder, strongest first:
 *   1. Session execution grade (`scoreSessionExecution`, 0–100, higher = better)
 *      — the most direct "did the session go well?" signal, available when a run
 *      has FIT streams.
 *   2. Aerobic efficiency vs. baseline (lower = better) — broader, HR-only.
 * A report window uses execution grade when present, else efficiency.
 */

/** Per-run outcome sample. Either/both signals may be present. */
export interface OutcomeSample {
  date: string;
  /** Aerobic-efficiency index (pace/HR). LOWER = better. */
  efficiency?: number;
  /** Session execution quality 0–100. HIGHER = better. */
  executionScore?: number;
}

/** @deprecated retained for callers that only have efficiency — assignable to OutcomeSample. */
export interface EfficiencySample {
  date: string;
  efficiency: number;
}

const BASE_HEAVY = DEFAULT_FEEL_CALIBRATION.heavyDelta; // −12
const BASE_FRESH = DEFAULT_FEEL_CALIBRATION.freshDelta; // +5
const HEAVY_CAP = -18; // strongest a heavy nudge can get
const HEAVY_FLOOR = -6; // weakest — a heavy report always drops readiness ≥6 (safety)
const FRESH_CAP = 8;
const FRESH_FLOOR = 3;
const WINDOW_DAYS = 2; // runs within 0–2 days after a report count as its outcome
const MIN_BASELINE = 4; // samples of a signal needed for a stable baseline median
const MIN_PAIRS = 6; // paired outcomes needed before deviating from the fallback
const HIGH_PAIRS = 12;
const PRIOR = 2; // Laplace prior strength → shrink toward 0.5
const SCALE_SENSITIVITY = 1.0;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * @param reports  the athlete's leg-feel history
 * @param samples  per-run outcome samples (execution grade and/or efficiency)
 * @param fallback the P3 calibration to use when there isn't enough paired evidence
 */
export function computeOutcomeCalibration(
  reports: FeelHistoryPoint[],
  samples: OutcomeSample[],
  fallback: FeelCalibration = DEFAULT_FEEL_CALIBRATION,
): FeelCalibration {
  const execScores = samples.filter((s) => s.executionScore != null).map((s) => s.executionScore!);
  const effScores = samples.filter((s) => s.efficiency != null).map((s) => s.efficiency!);
  const execMedian = execScores.length >= MIN_BASELINE ? median(execScores) : null;
  const effMedian = effScores.length >= MIN_BASELINE ? median(effScores) : null;
  if (execMedian == null && effMedian == null) return fallback;

  let confirmed = 0;
  let contradicted = 0;
  let usedExecution = false;
  for (const r of reports) {
    if (r.legs !== "heavy" && r.legs !== "fresh") continue;
    const window = samples.filter((s) => {
      const d = differenceInCalendarDays(parseISO(s.date), parseISO(r.date));
      return d >= 0 && d <= WINDOW_DAYS;
    });
    if (window.length === 0) continue;

    // Prefer the execution-grade verdict; fall back to efficiency.
    const execVals = window.map((s) => s.executionScore).filter((v): v is number => v != null);
    const effVals = window.map((s) => s.efficiency).filter((v): v is number => v != null);
    let ranWorse: boolean | null = null;
    if (execMedian != null && execVals.length > 0) {
      ranWorse = mean(execVals) < execMedian; // lower execution = worse
      usedExecution = true;
    } else if (effMedian != null && effVals.length > 0) {
      ranWorse = mean(effVals) > effMedian; // higher efficiency index = worse
    }
    if (ranWorse == null) continue; // no-data pair

    const feltHeavy = r.legs === "heavy";
    if ((feltHeavy && ranWorse) || (!feltHeavy && !ranWorse)) confirmed++;
    else contradicted++;
  }

  const pairs = confirmed + contradicted;
  if (pairs < MIN_PAIRS) return fallback;

  // Laplace-shrunk predictive reliability, pulled toward 0.5 on small samples.
  const reliability = (confirmed + PRIOR) / (pairs + 2 * PRIOR);
  const scale = clamp(1 + (reliability - 0.5) * SCALE_SENSITIVITY, 0.5, 1.5);
  const heavyDelta = Math.round(clamp(BASE_HEAVY * scale, HEAVY_CAP, HEAVY_FLOOR));
  const freshDelta = Math.round(clamp(BASE_FRESH * scale, FRESH_FLOOR, FRESH_CAP));
  const confidence = pairs >= HIGH_PAIRS ? "high" : "medium";
  const rawPct = Math.round((confirmed / pairs) * 100);
  const signal = usedExecution ? "session execution" : "how you ran";
  const basis =
    reliability > 0.55
      ? `Your reports predicted ${signal} ${rawPct}% of the time across ${pairs} sessions — carrying more weight.`
      : reliability < 0.45
        ? `Your reports matched ${signal} only ${rawPct}% of the time across ${pairs} sessions — carrying a little less weight.`
        : `Personalised from ${pairs} sessions of reported-feel vs. ${signal}.`;

  return { heavyDelta, freshDelta, sampleCount: pairs, reliability, confidence, basis };
}
