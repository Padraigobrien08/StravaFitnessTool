import { parseISO, differenceInCalendarDays } from "date-fns";
import {
  DEFAULT_FEEL_CALIBRATION,
  type FeelCalibration,
  type FeelHistoryPoint,
} from "./calibration";

/**
 * Outcome-based recalibration of the leg-feel nudge (P4 + signal refinements).
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
 * The outcome verdict is a ladder — the most direct signal with data wins,
 * broadening coverage to athletes with less data as it descends:
 *   1. Session execution grade (`scoreSessionExecution`, higher = better) — FIT.
 *   2. HR drift within the run (higher = more fatigue) — FIT. (Overlaps #1,
 *      which already factors drift; used when a full grade isn't available.)
 *   3. Aerobic efficiency vs. baseline (lower = better) — needs HR.
 *   4. Training-response: did near-term volume move the way the report implies
 *      (heavy → trained less), normalised within the athlete's own report
 *      windows — needs only run dates + distance. A behavioural proxy for a
 *      "skipped/curtailed session"; carries a rest-day confound, so it sits last.
 */

/** Per-run outcome sample. Any subset of signals may be present. */
export interface OutcomeSample {
  date: string;
  /** Aerobic-efficiency index (pace/HR). LOWER = better. */
  efficiency?: number;
  /** Session execution quality 0–100. HIGHER = better. */
  executionScore?: number;
  /** HR drift over the run, %. HIGHER = more fatigue = worse. */
  hrDriftPct?: number;
  /** Run distance (km) — for the training-response signal. */
  distanceKm?: number;
}

/** @deprecated retained for callers that only have efficiency — assignable to OutcomeSample. */
export interface EfficiencySample {
  date: string;
  efficiency: number;
}

export type OutcomeSignal = "execution" | "hr-drift" | "efficiency" | "training-response";

/** Raw pre-gate evidence: how reports paired with outcomes, by winning signal. */
export interface OutcomePairs {
  /** "heavy"→worse or "fresh"→better outcomes. */
  confirmed: number;
  /** reports whose outcome went the other way. */
  contradicted: number;
  /** confirmed + contradicted — the paired-evidence count the gate tests. */
  pairs: number;
  /** which rung of the ladder decided each pair. */
  signalCounts: Record<OutcomeSignal, number>;
}

const BASE_HEAVY = DEFAULT_FEEL_CALIBRATION.heavyDelta; // −12
const BASE_FRESH = DEFAULT_FEEL_CALIBRATION.freshDelta; // +5
const HEAVY_CAP = -18; // strongest a heavy nudge can get
const HEAVY_FLOOR = -6; // weakest — a heavy report always drops readiness ≥6 (safety)
const FRESH_CAP = 8;
const FRESH_FLOOR = 3;
const WINDOW_DAYS = 2; // runs within 0–2 days after a report count as its outcome
const MIN_BASELINE = 4; // samples/reports needed for a stable baseline median
const MIN_PAIRS = 6; // paired outcomes needed before deviating from the fallback
const HIGH_PAIRS = 12;
const PRIOR = 2; // Laplace prior strength → shrink toward 0.5
const SCALE_SENSITIVITY = 1.0;

const SIGNAL_PHRASE: Record<OutcomeSignal, string> = {
  execution: "session execution",
  "hr-drift": "heart-rate drift",
  efficiency: "how you ran",
  "training-response": "how you trained after",
};

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function mean(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function medianOrNull(nums: number[]): number | null {
  return nums.length >= MIN_BASELINE ? median(nums) : null;
}

/**
 * Pair each directional report with its 0–2-day outcome window and decide, via
 * the signal ladder, whether the session went worse (or better) than the
 * athlete's own baseline. Pre-gate and side-effect-free: the raw evidence the
 * calibration is built from, exposed for validation/backtesting.
 *
 * @param reports  the athlete's leg-feel history
 * @param samples  per-run outcome samples (execution / drift / efficiency / distance)
 */
export function scoreOutcomePairs(
  reports: FeelHistoryPoint[],
  samples: OutcomeSample[],
): OutcomePairs {
  const execMedian = medianOrNull(collect(samples, "executionScore"));
  const driftMedian = medianOrNull(collect(samples, "hrDriftPct"));
  const effMedian = medianOrNull(collect(samples, "efficiency"));

  const directional = reports.filter((r) => r.legs === "heavy" || r.legs === "fresh");
  const windows = directional.map((r) => {
    const inWin = samples.filter((s) => {
      const d = differenceInCalendarDays(parseISO(s.date), parseISO(r.date));
      return d >= 0 && d <= WINDOW_DAYS;
    });
    return {
      legs: r.legs,
      execMean: mean(collect(inWin, "executionScore")),
      driftMean: mean(collect(inWin, "hrDriftPct")),
      effMean: mean(collect(inWin, "efficiency")),
      windowKm: collect(inWin, "distanceKm").reduce((a, b) => a + b, 0),
    };
  });

  // Behavioural (training-response) baseline: usable only with enough reports and
  // real variation in near-term volume across them.
  const windowKms = windows.map((w) => w.windowKm);
  const behaviouralUsable = directional.length >= MIN_BASELINE && new Set(windowKms).size > 1;
  const windowKmMedian = behaviouralUsable ? median(windowKms) : null;

  let confirmed = 0;
  let contradicted = 0;
  const signalCounts: Record<OutcomeSignal, number> = {
    execution: 0,
    "hr-drift": 0,
    efficiency: 0,
    "training-response": 0,
  };

  for (const w of windows) {
    let worse: boolean | null = null;
    let signal: OutcomeSignal | null = null;
    if (execMedian != null && w.execMean != null) {
      worse = w.execMean < execMedian; // lower execution = worse
      signal = "execution";
    } else if (driftMedian != null && w.driftMean != null) {
      worse = w.driftMean > driftMedian; // more drift = worse
      signal = "hr-drift";
    } else if (effMedian != null && w.effMean != null) {
      worse = w.effMean > effMedian; // higher index = slower at HR = worse
      signal = "efficiency";
    } else if (windowKmMedian != null) {
      worse = w.windowKm < windowKmMedian; // trained less = backed off
      signal = "training-response";
    }
    if (worse == null || signal == null) continue; // no-data pair

    const feltHeavy = w.legs === "heavy";
    if ((feltHeavy && worse) || (!feltHeavy && !worse)) confirmed++;
    else contradicted++;
    signalCounts[signal]++;
  }

  return { confirmed, contradicted, pairs: confirmed + contradicted, signalCounts };
}

/**
 * @param reports  the athlete's leg-feel history
 * @param samples  per-run outcome samples (execution / drift / efficiency / distance)
 * @param fallback the P3 calibration to use when there isn't enough paired evidence
 */
export function computeOutcomeCalibration(
  reports: FeelHistoryPoint[],
  samples: OutcomeSample[],
  fallback: FeelCalibration = DEFAULT_FEEL_CALIBRATION,
): FeelCalibration {
  const { confirmed, pairs, signalCounts } = scoreOutcomePairs(reports, samples);
  if (pairs < MIN_PAIRS) return fallback;

  // Laplace-shrunk predictive reliability, pulled toward 0.5 on small samples.
  const reliability = (confirmed + PRIOR) / (pairs + 2 * PRIOR);
  const scale = clamp(1 + (reliability - 0.5) * SCALE_SENSITIVITY, 0.5, 1.5);
  const heavyDelta = Math.round(clamp(BASE_HEAVY * scale, HEAVY_CAP, HEAVY_FLOOR));
  const freshDelta = Math.round(clamp(BASE_FRESH * scale, FRESH_FLOOR, FRESH_CAP));
  const confidence = pairs >= HIGH_PAIRS ? "high" : "medium";
  const rawPct = Math.round((confirmed / pairs) * 100);
  const dominant = (Object.keys(signalCounts) as OutcomeSignal[]).reduce((a, b) =>
    signalCounts[b] > signalCounts[a] ? b : a,
  );
  const phrase = SIGNAL_PHRASE[dominant];
  const basis =
    reliability > 0.55
      ? `Your reports predicted ${phrase} ${rawPct}% of the time across ${pairs} sessions — carrying more weight.`
      : reliability < 0.45
        ? `Your reports matched ${phrase} only ${rawPct}% of the time across ${pairs} sessions — carrying a little less weight.`
        : `Personalised from ${pairs} sessions of reported-feel vs. ${phrase}.`;

  return { heavyDelta, freshDelta, sampleCount: pairs, reliability, confidence, basis };
}

function collect(samples: OutcomeSample[], key: keyof OutcomeSample): number[] {
  return samples.map((s) => s[key]).filter((v): v is number => typeof v === "number");
}
