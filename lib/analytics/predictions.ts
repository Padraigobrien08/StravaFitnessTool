import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { PersonalRecord } from "./records";
import { findPersonalRecords, predictRaceTime } from "./records";
import { paceSecPerKm } from "./pace";
import type { RunWorkoutLabel, WorkoutType } from "./workoutType";

export const RACE_TARGETS = [
  { key: "5k", label: "5K", distanceKm: 5 },
  { key: "10k", label: "10K", distanceKm: 10 },
  { key: "hm", label: "Half Marathon", distanceKm: 21.0975 },
  { key: "marathon", label: "Marathon", distanceKm: 42.195 },
] as const;

export interface EffortPoint {
  distanceKm: number;
  timeSec: number;
  runId: string;
  runName: string;
  date: string;
  source: string;
}

export interface ModelPrediction {
  distanceKm: number;
  label: string;
  timeSec: number;
}

export interface PredictionModelResult {
  id: string;
  name: string;
  description: string;
  formula: string;
  anchorLabel?: string;
  exponent?: number;
  rSquared?: number;
  predictions: ModelPrediction[];
}

export interface ConsensusPrediction {
  label: string;
  distanceKm: number;
  timeSec: number;
  timeMin: number;
  timeMax: number;
  spreadSec: number;
}

export interface RegressionFit {
  exponent: number;
  coefficient: number;
  /**
   * Goodness of fit in log space. Kept for continuity, but near-useless as a quality
   * signal here — the axes are collinear by construction, so this sits above 0.9 for
   * almost any effort set. Judge the fit by `residualLogSd` and `exponentStdError`.
   */
  rSquared: number;
  /** SD of log-time residuals; null when n < 3. Roughly a proportion: 0.05 ≈ 5%. */
  residualLogSd: number | null;
  /** Standard error of the fitted exponent; null when n < 3 or distances don't vary. */
  exponentStdError: number | null;
  pointCount: number;
  /** Sampled curve for charts: distanceKm → timeSec */
  curve: { distanceKm: number; timeSec: number }[];
}

export interface RacePredictionAnalysis {
  efforts: EffortPoint[];
  models: PredictionModelResult[];
  consensus: ConsensusPrediction[];
  primaryAnchor: EffortPoint | null;
  regression: RegressionFit | null;
  explanation: string[];
  confidence: "low" | "medium" | "high";
}

function runById(runs: RunActivity[], id: string) {
  return runs.find((r) => r.id === id);
}

/**
 * Workout types a *whole activity* may be admitted under.
 *
 * A full activity is only a comparable effort if it was actually run as one. `easy`,
 * `recovery` and `long` are excluded: a long run is distance-relevant but run at
 * aerobic pace, and treating it as a race effort is what flattens the power-law
 * exponent. Long-run support is modelled separately by `durabilityModel`.
 */
const EFFORT_WORKOUT_TYPES: ReadonlySet<WorkoutType> = new Set(["race", "tempo", "interval"]);

/**
 * Whether an effort is comparable to a race performance.
 *
 * Single definition shared with Forecasting V2, which previously carried two
 * divergent inline copies (`buildInput.ts` and `capabilityModels.ts`) while V1's
 * regression had none at all.
 *
 * A lap block or device best-effort window is a measured hard segment, so it counts.
 * A whole activity only counts when it was actually raced — which the source string
 * alone cannot tell you, hence the optional classification.
 */
export function isRaceLikeEffort(effort: EffortPoint, workoutType?: WorkoutType): boolean {
  if (effort.distanceKm < 4 || effort.distanceKm > 22) return false;
  if (effort.source.includes("Lap") || effort.source.includes("Best")) return true;
  return workoutType === "race";
}

export interface CollectEffortOptions {
  /**
   * Per-run workout classifications. When supplied, whole activities must classify
   * as a genuine effort to be admitted; without them the pace gate alone applies,
   * which is the historical behaviour and keeps callers that have no labels working.
   */
  workoutLabels?: RunWorkoutLabel[];
}

/** Collect comparable race-effort points from FIT best efforts + quality runs. */
export function collectEffortPoints(
  runs: RunActivity[],
  fitDetails: FitRunDetail[],
  personalRecords: PersonalRecord[],
  opts: CollectEffortOptions = {},
): EffortPoint[] {
  const points: EffortPoint[] = [];
  const seen = new Set<string>();

  const add = (p: EffortPoint) => {
    const key = `${p.runId}-${p.distanceKm.toFixed(2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (p.distanceKm < 2.5 || p.distanceKm > 45) return;
    if (p.timeSec <= 0) return;
    points.push(p);
  };

  for (const fit of fitDetails) {
    const run = runById(runs, fit.activityId);
    if (!run) continue;
    for (const e of fit.bestEfforts ?? []) {
      add({
        distanceKm: e.distanceM / 1000,
        timeSec: e.timeSec,
        runId: run.id,
        runName: run.name,
        date: run.date,
        source: e.source === "laps" ? "Lap block" : "Best effort",
      });
    }
  }

  for (const pr of personalRecords) {
    if (pr.bucket === "long") continue;
    add({
      distanceKm: pr.distanceKm,
      timeSec: pr.timeSec,
      runId: pr.runId,
      runName: pr.runName,
      date: pr.date,
      source:
        pr.source === "full_run" ? "Full run" : pr.source === "laps" ? "Lap block" : "Best effort",
    });
  }

  // Whole activities. The pace gate alone (≤ 8:00/km) admitted ordinary easy running
  // as a "race-quality effort", which dragged the fitted exponent toward 1.0 — i.e.
  // toward "pace never fades with distance". Prefer the workout classification when
  // the caller has it.
  const typeById = opts.workoutLabels
    ? new Map(opts.workoutLabels.map((l) => [l.runId, l.classification.type]))
    : null;

  for (const run of runs) {
    const km = run.distanceM / 1000;
    if (km < 3 || km > 30) continue;
    const pace = paceSecPerKm(run);
    if (!pace || pace > 480) continue;
    if (typeById && !EFFORT_WORKOUT_TYPES.has(typeById.get(run.id) ?? "unknown")) continue;
    add({
      distanceKm: km,
      timeSec: run.movingSec || run.elapsedSec,
      runId: run.id,
      runName: run.name,
      date: run.date,
      source: "Full run",
    });
  }

  return points.sort((a, b) => a.distanceKm - b.distanceKm);
}

const METERS_PER_MILE = 1609.344;

/**
 * Cameron's distance-equivalence factor.
 *
 * `distanceMiles` must be in **miles** — the coefficients are fitted to imperial
 * distances and produce nonsense when fed kilometres.
 */
function cameronFactor(distanceMiles: number): number {
  return 13.49681 - 0.048865 * distanceMiles + 2.438936 / Math.pow(distanceMiles, 0.7905);
}

/**
 * Cameron's equivalence model: T₂ = T₁ · (D₂/D₁) · (a(D₁)/a(D₂)).
 *
 * This previously computed `T₁ · (D₂/D₁) · (2 − D₁/D₂)`, which is not Cameron's
 * model — or anyone's. That trailing factor tends to **2** as the extrapolation
 * grows, so it roughly doubled predicted pace: the demo athlete's 5.5 km anchor
 * projected to 2:30:22 for a half marathon where the other three models agreed on
 * 1:33–1:43. Because the model is averaged into the consensus, one bad model moved
 * the headline number by ~14 minutes.
 *
 * The published form reproduces standard equivalence tables — a 20:00 5K gives
 * 41:40 for 10K and 3:15:11 for the marathon — and stays slower than Riegel at
 * marathon distance, which is the property this model exists to provide.
 */
export function predictCameron(distanceM1: number, timeSec1: number, distanceM2: number): number {
  if (distanceM1 <= 0 || distanceM2 <= 0 || timeSec1 <= 0) return 0;
  const d1 = distanceM1 / METERS_PER_MILE;
  const d2 = distanceM2 / METERS_PER_MILE;
  return timeSec1 * (d2 / d1) * (cameronFactor(d1) / cameronFactor(d2));
}

/** Fit T = k * D^b in log space via least squares */
export function fitPowerLawRegression(efforts: EffortPoint[]): RegressionFit | null {
  const usable = efforts.filter((e) => e.distanceKm >= 3 && e.distanceKm <= 30 && e.timeSec > 0);
  if (usable.length < 3) return null;

  const xs = usable.map((e) => Math.log(e.distanceKm));
  const ys = usable.map((e) => Math.log(e.timeSec));
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXX = xs.reduce((a, b) => a + b * b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;

  const exponent = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - exponent * sumX) / n;
  const coefficient = Math.exp(intercept);

  const meanY = sumY / n;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  // Residuals are measured against the fitted line at each point's log-distance
  // (xs[i]) — not its log-time. Reducing over `ys` here and using the accumulator
  // callback's element as the predictor is what made this return negative R².
  const ssRes = xs.reduce((s, x, i) => {
    const pred = intercept + exponent * x;
    return s + (ys[i] - pred) ** 2;
  }, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Standard OLS inference. `dof` is n-2 because two parameters were estimated.
  //
  // These are what R² cannot tell you here. log(time) and log(distance) are nearly
  // collinear by construction, so ssTot is enormous and R² lands above 0.9 for almost
  // any effort set, including a badly polluted one — it measures "distance predicts
  // time", which was never in doubt.
  //
  //   residualLogSd  — SD of the log-time residuals. Scale-free, and for small values
  //                    reads directly as a percentage: 0.05 ≈ 5% typical scatter.
  //   exponentStdError — how well-determined the fatigue-resistance exponent is. This
  //                    is the one that governs extrapolation: predicting a marathon
  //                    from a 10 km anchor multiplies exponent error by ln(42.195/10)
  //                    ≈ 1.44, so ±0.08 on the exponent is ±11% on the predicted time.
  const dof = n - 2;
  const residualVariance = dof > 0 ? ssRes / dof : null;
  const residualLogSd = residualVariance !== null ? Math.sqrt(residualVariance) : null;
  const sxx = sumXX - (sumX * sumX) / n;
  const exponentStdError =
    residualVariance !== null && sxx > 0 ? Math.sqrt(residualVariance / sxx) : null;

  const curve: { distanceKm: number; timeSec: number }[] = [];
  for (let d = 3; d <= 44; d += 0.5) {
    curve.push({
      distanceKm: d,
      timeSec: coefficient * Math.pow(d, exponent),
    });
  }

  return {
    exponent,
    coefficient,
    rSquared: Math.round(rSquared * 1000) / 1000,
    residualLogSd,
    exponentStdError,
    pointCount: n,
    curve,
  };
}

/** Half-width of the ~95% confidence interval on the fitted exponent. */
export function exponentCi95(fit: RegressionFit): number | null {
  return fit.exponentStdError === null ? null : 1.96 * fit.exponentStdError;
}

/** Typical scatter of the fit, as a percentage of predicted time. */
export function typicalErrorPct(fit: RegressionFit): number | null {
  // exp(σ) − 1 converts a log-space SD into a proportional one. Exact rather than
  // the small-σ approximation σ ≈ pct, which drifts once scatter gets large.
  return fit.residualLogSd === null ? null : (Math.exp(fit.residualLogSd) - 1) * 100;
}

/**
 * ≈7.3% typical scatter.
 *
 * Anchored to the one real race this forecaster has been scored against, where it came
 * in 7.5% out (see docs/LIMITATIONS.md). Claiming high confidence on a curve tighter
 * than the only error ever actually measured would be inventing precision.
 *
 * Checked against data rather than picked: the demo athlete's properly classified
 * effort set — 64 efforts, exponent 1.063, the best case a real runner is likely to
 * present — sits at 5.1%, and a threshold of 5% rejected it. A top confidence level
 * nothing can reach is not a strict scale, it is a broken one.
 */
const HIGH_MAX_RESIDUAL_LOG_SD = 0.07;

/** ≈±11% when extrapolating a 10 km anchor to a marathon. */
const HIGH_MAX_EXPONENT_CI95 = 0.08;

/** ≈13% typical scatter — beyond this the efforts do not describe one curve. */
const MEDIUM_MAX_RESIDUAL_LOG_SD = 0.12;

/**
 * How much to trust the race predictions.
 *
 * This used to be `efforts >= 5 && rSquared > 0.9`, which certified almost anything.
 * R² is inflated here by the collinearity of the axes (see `fitPowerLawRegression`),
 * so the gate fired on effort sets that were visibly poor — including ones polluted
 * with easy running, which is the exact failure `collectEffortPoints` exists to stop.
 *
 * The replacement asks the two questions that actually bear on a prediction: how
 * closely do the efforts sit on a single curve, and how well-pinned is the exponent
 * being extrapolated. A set can satisfy R² > 0.99 and fail both.
 *
 * Thresholds are deliberately reachable — a well-trained runner with five genuine
 * efforts across 5–21 km should qualify. They are a floor on evidence, not a bar
 * calibrated against observed race error, which would need scored races to set.
 */
export function racePredictionConfidence(
  effortCount: number,
  regression: RegressionFit | null,
): "low" | "medium" | "high" {
  if (effortCount < 3) return "low";

  const residual = regression?.residualLogSd ?? null;
  const ci95 = regression ? exponentCi95(regression) : null;

  if (
    effortCount >= 5 &&
    residual !== null &&
    ci95 !== null &&
    residual <= HIGH_MAX_RESIDUAL_LOG_SD &&
    ci95 <= HIGH_MAX_EXPONENT_CI95
  ) {
    return "high";
  }

  // Scatter this wide means the efforts do not describe one curve, so the models are
  // averaging noise. Report low even though there are enough points to fit.
  if (residual !== null && residual > MEDIUM_MAX_RESIDUAL_LOG_SD) return "low";

  return "medium";
}

/**
 * The fit's quality in the athlete's terms.
 *
 * Reports typical scatter and the exponent's uncertainty rather than R², which read
 * "R²=0.99" on curves that were plainly bad and so told the athlete the opposite of
 * the truth.
 */
function describeFitQuality(fit: RegressionFit): string {
  const pct = typicalErrorPct(fit);
  const ci = exponentCi95(fit);
  if (pct === null || ci === null) return "";
  return (
    `, with your efforts sitting about ${pct.toFixed(1)}% off it on average` +
    ` and the exponent pinned to ±${ci.toFixed(2)}`
  );
}

function pickAnchor(efforts: EffortPoint[]): EffortPoint | null {
  const candidates = efforts.filter((e) => e.distanceKm >= 4 && e.distanceKm <= 15);
  if (candidates.length === 0) return efforts[0] ?? null;
  return [...candidates].sort((a, b) => a.timeSec / a.distanceKm - b.timeSec / b.distanceKm)[0];
}

function predictFromAnchor(
  anchor: EffortPoint,
  model: "riegel" | "cameron",
  exponent?: number,
): ModelPrediction[] {
  const d1 = anchor.distanceKm * 1000;
  return RACE_TARGETS.map((t) => {
    let timeSec: number;
    if (model === "riegel") {
      timeSec = predictRaceTime(d1, anchor.timeSec, t.distanceKm * 1000);
    } else if (model === "cameron") {
      timeSec = predictCameron(d1, anchor.timeSec, t.distanceKm * 1000);
    } else {
      timeSec = predictRaceTime(d1, anchor.timeSec, t.distanceKm * 1000);
    }
    if (exponent !== undefined && model === "riegel") {
      timeSec = anchor.timeSec * Math.pow(t.distanceKm / anchor.distanceKm, exponent);
    }
    return {
      label: t.label,
      distanceKm: t.distanceKm,
      timeSec,
    };
  });
}

function predictFromRegression(reg: RegressionFit): ModelPrediction[] {
  return RACE_TARGETS.map((t) => ({
    label: t.label,
    distanceKm: t.distanceKm,
    timeSec: reg.coefficient * Math.pow(t.distanceKm, reg.exponent),
  }));
}

/** Average time predictions from top 3 efforts by speed (Riegel from each). */
function predictMultiAnchor(efforts: EffortPoint[]): ModelPrediction[] {
  const anchors = [...efforts]
    .filter((e) => e.distanceKm >= 4 && e.distanceKm <= 21)
    // `b.timeSec / b.timeSec` is always 1, so this comparator returned
    // `pace(a) - 1` and never compared the two efforts: "top 3 by speed" picked
    // arbitrarily rather than fastest-first.
    .sort((a, b) => a.timeSec / a.distanceKm - b.timeSec / b.distanceKm)
    .slice(0, 3);
  if (anchors.length === 0) return [];

  return RACE_TARGETS.map((t) => {
    const times = anchors.map((a) =>
      predictRaceTime(a.distanceKm * 1000, a.timeSec, t.distanceKm * 1000),
    );
    const avg = times.reduce((s, x) => s + x, 0) / times.length;
    return { label: t.label, distanceKm: t.distanceKm, timeSec: avg };
  });
}

export function buildRacePredictionAnalysis(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = [],
  opts: CollectEffortOptions = {},
): RacePredictionAnalysis {
  const personalRecords = findPersonalRecords(runs, fitDetails);
  const efforts = collectEffortPoints(runs, fitDetails, personalRecords, opts);
  const anchor = pickAnchor(efforts);
  const regression = fitPowerLawRegression(efforts);

  const models: PredictionModelResult[] = [];

  if (anchor) {
    models.push({
      id: "riegel",
      name: "Riegel (1981)",
      description:
        "Classic endurance scaling: assumes performance decays predictably as distance grows.",
      formula: "T₂ = T₁ × (D₂/D₁)^1.06",
      anchorLabel: `${anchor.runName} (${anchor.distanceKm.toFixed(1)} km, ${formatShortTime(anchor.timeSec)})`,
      exponent: 1.06,
      predictions: predictFromAnchor(anchor, "riegel"),
    });
    models.push({
      id: "cameron",
      name: "Cameron (1982)",
      description:
        "Alternative equivalence model: often more conservative for marathon extrapolation.",
      formula: "T₂ = T₁ × (D₂/D₁) × (a(D₁)/a(D₂))",
      anchorLabel: `${anchor.runName}`,
      predictions: predictFromAnchor(anchor, "cameron"),
    });
  }

  if (regression) {
    models.push({
      id: "regression",
      name: "Your performance curve",
      description: `Power-law fit through ${regression.pointCount} efforts in your data, personalized exponent.`,
      formula: `T = ${regression.coefficient.toFixed(1)} × D^${regression.exponent.toFixed(3)}`,
      exponent: regression.exponent,
      rSquared: regression.rSquared,
      predictions: predictFromRegression(regression),
    });
  }

  if (efforts.length >= 3) {
    models.push({
      id: "multi",
      name: "Multi-effort average",
      description:
        "Riegel prediction averaged from your three fastest efforts (by pace) between 4–21 km.",
      formula: "Mean of Riegel projections from top 3 efforts",
      predictions: predictMultiAnchor(efforts),
    });
  }

  const consensus: ConsensusPrediction[] = RACE_TARGETS.map((t) => {
    const times = models
      .map((m) => m.predictions.find((p) => p.label === t.label)?.timeSec)
      .filter((x): x is number => x !== undefined && x > 0);
    if (times.length === 0) {
      return {
        label: t.label,
        distanceKm: t.distanceKm,
        timeSec: 0,
        timeMin: 0,
        timeMax: 0,
        spreadSec: 0,
      };
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    return {
      label: t.label,
      distanceKm: t.distanceKm,
      timeSec: Math.round(avg),
      timeMin: min,
      timeMax: max,
      spreadSec: max - min,
    };
  }).filter((c) => c.timeSec > 0);

  const confidence = racePredictionConfidence(efforts.length, regression);

  const fitQuality = regression ? describeFitQuality(regression) : null;

  const explanation: string[] = [
    opts.workoutLabels
      ? `We plot ${efforts.length} comparable efforts: your personal bests, lap blocks and best segments inside longer workouts, plus whole runs you actually raced or ran as tempo/interval work. Easy and long runs are excluded — they would flatten the curve.`
      : `We plot ${efforts.length} efforts from your runs (full runs, lap blocks, and best segments inside longer workouts). Without workout classification these are filtered by pace alone, so easy running may be included.`,
    anchor
      ? `Single-effort models anchor on your fastest effort in the 4–15 km range: "${anchor.runName}" (${formatShortTime(anchor.timeSec)} at ${anchor.distanceKm.toFixed(1)} km, ${anchor.source}).`
      : "No strong anchor effort found in the 4–15 km range.",
    regression && fitQuality
      ? `Your personal curve has exponent ${regression.exponent.toFixed(2)}${fitQuality}. A steeper exponent means pace fades faster with distance.`
      : "Not enough efforts for a reliable personalized curve (need ≥3 between 3–30 km).",
    `Consensus times are the average across ${models.length} models; the spread shows model agreement (tighter = more confident).`,
    "Predictions are estimates: course, weather, training, and tactics on race day will shift real results.",
  ];

  return {
    efforts,
    models,
    consensus,
    primaryAnchor: anchor,
    regression,
    explanation,
    confidence,
  };
}

function formatShortTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
