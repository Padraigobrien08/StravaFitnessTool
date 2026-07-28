import { parseISO, differenceInCalendarDays } from "date-fns";
import {
  DEFAULT_FEEL_CALIBRATION,
  type FeelCalibration,
  type FeelHistoryPoint,
} from "./calibration";

/**
 * Outcome-based recalibration of the leg-feel nudge (P4).
 *
 * Where P3 used *agreement with the load model* as a proxy for thoughtful
 * reporting (and could only ever amplify), this uses actual results: did a
 * "heavy" report precede genuinely worse running, and "fresh" better running?
 * Because that's real evidence — not a proxy — it is **bidirectional**: a
 * reporter whose reads reliably predict performance is trusted more; one whose
 * reads are counter-predictive is trusted less. It stays bounded and floored
 * (a "heavy" report can never be worth less than −6), and it is heavily shrunk
 * toward the default on small samples. Below the pair gate it defers to the
 * P3 result (which itself defers to the flat default).
 *
 * Efficiency convention (see lib/analytics/efficiency): LOWER = better (faster
 * at a given HR). So a report is "confirmed" when heavy→above-median efficiency
 * (ran worse) or fresh→below-median (ran better).
 */

/** Minimal per-run efficiency sample (kept local so lib/wellness stays analytics-free). */
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
const MIN_EFF_POINTS = 4; // need a stable efficiency baseline
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

/**
 * @param reports  the athlete's leg-feel history
 * @param efficiency  per-run efficiency samples (date + index; lower = better)
 * @param fallback  the P3 calibration to use when there isn't enough paired evidence
 */
export function computeOutcomeCalibration(
  reports: FeelHistoryPoint[],
  efficiency: EfficiencySample[],
  fallback: FeelCalibration = DEFAULT_FEEL_CALIBRATION,
): FeelCalibration {
  if (efficiency.length < MIN_EFF_POINTS) return fallback;

  const med = median(efficiency.map((e) => e.efficiency));

  let confirmed = 0;
  let contradicted = 0;
  for (const r of reports) {
    if (r.legs !== "heavy" && r.legs !== "fresh") continue;
    const window = efficiency.filter((e) => {
      const d = differenceInCalendarDays(parseISO(e.date), parseISO(r.date));
      return d >= 0 && d <= WINDOW_DAYS;
    });
    if (window.length === 0) continue; // no-data pair
    const windowEff = window.reduce((a, e) => a + e.efficiency, 0) / window.length;
    const ranWorse = windowEff > med; // higher index = slower at HR = worse
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
  const basis =
    reliability > 0.55
      ? `Your reports predicted how you actually ran ${rawPct}% of the time across ${pairs} sessions — carrying more weight.`
      : reliability < 0.45
        ? `Your reports matched how you ran only ${rawPct}% of the time across ${pairs} sessions — carrying a little less weight.`
        : `Personalised from ${pairs} sessions of reported-feel vs. how you ran.`;

  return { heavyDelta, freshDelta, sampleCount: pairs, reliability, confidence, basis };
}
