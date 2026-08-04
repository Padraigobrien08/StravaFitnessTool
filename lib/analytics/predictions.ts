import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { PersonalRecord } from "./records";
import { findPersonalRecords, predictRaceTime } from "./records";
import { paceSecPerKm } from "./pace";

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
  rSquared: number;
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

/** Collect comparable race-effort points from FIT best efforts + quality runs. */
export function collectEffortPoints(
  runs: RunActivity[],
  fitDetails: FitRunDetail[],
  personalRecords: PersonalRecord[],
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

  for (const run of runs) {
    const km = run.distanceM / 1000;
    if (km < 3 || km > 30) continue;
    const pace = paceSecPerKm(run);
    if (!pace || pace > 480) continue;
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

/** Cameron: T2 = T1 * (D2/D1) * (2 - D1/D2) — better for extrapolating up in distance */
export function predictCameron(distanceM1: number, timeSec1: number, distanceM2: number): number {
  const ratio = distanceM2 / distanceM1;
  return timeSec1 * ratio * (2 - distanceM1 / distanceM2);
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
  const ssRes = ys.reduce((s, x, i) => {
    const pred = intercept + exponent * x;
    return s + (ys[i] - pred) ** 2;
  }, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

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
    pointCount: n,
    curve,
  };
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
    .sort((a, b) => a.timeSec / a.distanceKm - b.timeSec / b.timeSec)
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
): RacePredictionAnalysis {
  const personalRecords = findPersonalRecords(runs, fitDetails);
  const efforts = collectEffortPoints(runs, fitDetails, personalRecords);
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
      formula: "T₂ = T₁ × (D₂/D₁) × (2 − D₁/D₂)",
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

  let confidence: "low" | "medium" | "high" = "low";
  if (efforts.length >= 5 && regression && regression.rSquared > 0.9) {
    confidence = "high";
  } else if (efforts.length >= 3) {
    confidence = "medium";
  }

  const explanation: string[] = [
    `We plot ${efforts.length} race-quality efforts from your runs (full runs, lap blocks, and best segments inside longer workouts).`,
    anchor
      ? `Single-effort models anchor on your fastest effort in the 4–15 km range: "${anchor.runName}" (${formatShortTime(anchor.timeSec)} at ${anchor.distanceKm.toFixed(1)} km, ${anchor.source}).`
      : "No strong anchor effort found in the 4–15 km range.",
    regression
      ? `The regression line fits time vs distance in your data (exponent ${regression.exponent.toFixed(2)}, R²=${regression.rSquared.toFixed(2)}). Steeper exponent means pace fades faster with distance.`
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
