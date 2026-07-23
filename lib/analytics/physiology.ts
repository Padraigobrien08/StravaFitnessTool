import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { collectEffortPoints, fitPowerLawRegression, type EffortPoint } from "./predictions";
import { findPersonalRecords } from "./records";
import { computeLateFadePct } from "@/lib/reasoning/executionScore";

/**
 * Elite physiology — metrics most tools don't compute, fitted to *this* athlete
 * rather than read off a population table. Glass-box by contract: every number
 * carries its evidence, its confidence, and what it can't yet say.
 *
 * P1 — Critical Speed (CS) + D′:
 *   The two-parameter critical-speed model separates the aerobic ceiling (CS,
 *   the speed sustainable "indefinitely") from the anaerobic reserve (D′, a
 *   fixed distance bank spendable above CS). Fitting the athlete's own best
 *   efforts turns "how fast are you?" into two independently trainable numbers.
 *
 * P2 — Personalized fatigue-resistance:
 *   The exponent of the athlete's own power-law time–distance fit *is* their
 *   fatigue-resistance number. Riegel's textbook exponent is ~1.06; a higher
 *   personal exponent means pace fades faster as distance grows. Surfaced with
 *   a plain-English "how much more you fade per doubling" and a direction of
 *   travel over recent vs older efforts.
 *
 * P3 — Durability score:
 *   Fatigue-resistance *under load* — how well the athlete holds efficiency and
 *   pace deep into long/sustained runs. Blends aerobic decoupling (HR drift,
 *   first vs second half) with late-run pace fade (last third vs first third)
 *   across recent endurance sessions into a 0–100 score with a trend. This is
 *   the modern differentiator, and is DISTINCT from the forecaster's
 *   `assessDurability` (that scores long-run *distance* support for a specific
 *   race; this is a longitudinal *physiological* metric independent of any goal).
 */

export interface CriticalSpeedFit {
  /** Critical speed in m/s — slope of the distance–time line. */
  csMetersPerSec: number;
  /** Anaerobic distance reserve in meters — intercept of the distance–time line. */
  dPrimeMeters: number;
  rSquared: number;
  /** Number of efforts used in the fit. */
  n: number;
}

export interface CriticalSpeedAssessment {
  available: boolean;
  csMetersPerSec: number | null;
  /** CS expressed as a running pace (sec/km) for display. */
  csPaceSecPerKm: number | null;
  dPrimeMeters: number | null;
  rSquared: number | null;
  n: number;
  confidence: "low" | "medium" | "high";
  interpretation: string;
  evidence: string[];
  limitations: string[];
}

export interface FatigueResistanceAssessment {
  available: boolean;
  /** Personal power-law exponent (time ∝ distance^exponent). */
  exponent: number | null;
  /** Textbook Riegel reference exponent. */
  referenceExponent: number;
  /** Extra % of time added per doubling of distance vs the reference. */
  extraFadePerDoublingPct: number | null;
  rSquared: number | null;
  n: number;
  /** Direction of the exponent over recent vs older efforts. */
  trend: "improving" | "declining" | "stable" | null;
  trendDetail: string | null;
  confidence: "low" | "medium" | "high";
  interpretation: string;
  evidence: string[];
  limitations: string[];
}

export interface DurabilityScoreAssessment {
  available: boolean;
  /** 0–100 — higher means efficiency and pace hold up deep into long runs. */
  score: number | null;
  label: "weak" | "moderate" | "strong" | null;
  /** Median HR-drift (first→second half) across the sampled runs, %. */
  decouplingMedianPct: number | null;
  /** Median late-run pace fade (last third vs first third), %. */
  lateFadeMedianPct: number | null;
  trend: "improving" | "declining" | "stable" | null;
  /** Number of endurance runs with a usable stream signal. */
  sampleSize: number;
  confidence: "low" | "medium" | "high";
  interpretation: string;
  evidence: string[];
  limitations: string[];
}

export interface AthletePhysiology {
  criticalSpeed: CriticalSpeedAssessment;
  fatigueResistance: FatigueResistanceAssessment;
  durability: DurabilityScoreAssessment;
}

/** Riegel's classic endurance-scaling exponent — the reference to compare against. */
export const RIEGEL_REFERENCE_EXPONENT = 1.06;

/** Duration band where the two-parameter CS model is physiologically valid. */
const CS_MIN_SEC = 120; // ~2 min — below this, non-CS energetics dominate
const CS_MAX_SEC = 1800; // ~30 min — beyond this, glycogen/durability confound the line

/**
 * Fit the two-parameter critical-speed model: distance = CS·t + D′.
 * Ordinary least squares of distance (m) on time (s); slope is CS, intercept D′.
 * Returns null when the efforts are too few, too clustered in duration, or the
 * fit is implausible (non-positive CS, or a large negative reserve).
 */
export function fitCriticalSpeed(
  points: { distanceKm: number; timeSec: number }[],
): CriticalSpeedFit | null {
  const usable = points.filter(
    (p) => p.timeSec >= CS_MIN_SEC && p.timeSec <= CS_MAX_SEC && p.distanceKm > 0,
  );
  if (usable.length < 3) return null;

  const times = usable.map((p) => p.timeSec);
  const spread = Math.max(...times) / Math.min(...times);
  // Need a real lever arm in duration, or the line is under-determined.
  if (spread < 1.5) return null;

  const xs = times; // seconds
  const ys = usable.map((p) => p.distanceKm * 1000); // meters
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXX = xs.reduce((a, b) => a + b * b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;

  const cs = (n * sumXY - sumX * sumY) / denom; // slope = critical speed (m/s)
  const dPrime = (sumY - cs * sumX) / n; // intercept = anaerobic reserve (m)

  // Physiological sanity: CS positive and in a plausible running range; a small
  // negative reserve is rounding noise, a large one means the model doesn't fit.
  if (!Number.isFinite(cs) || cs <= 1 || cs > 8) return null;
  if (!Number.isFinite(dPrime) || dPrime < -100) return null;

  const meanY = sumY / n;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, _y, i) => s + (ys[i] - (cs * xs[i] + dPrime)) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    csMetersPerSec: cs,
    dPrimeMeters: Math.max(0, dPrime),
    rSquared: Math.round(rSquared * 1000) / 1000,
    n,
  };
}

/** Predicted time (s) to cover distanceM at critical-speed capability. */
export function criticalSpeedPredictSec(fit: CriticalSpeedFit, distanceM: number): number | null {
  const net = distanceM - fit.dPrimeMeters;
  if (net <= 0 || fit.csMetersPerSec <= 0) return null;
  return net / fit.csMetersPerSec;
}

function csConfidence(n: number, rSquared: number): "low" | "medium" | "high" {
  if (n >= 5 && rSquared >= 0.95) return "high";
  if (n >= 4 && rSquared >= 0.85) return "medium";
  return "low";
}

function paceStr(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

/** Assess Critical Speed + D′ from race-quality effort points, glass-box. */
export function assessCriticalSpeed(efforts: EffortPoint[]): CriticalSpeedAssessment {
  const fit = fitCriticalSpeed(efforts);
  if (!fit) {
    const inBand = efforts.filter((e) => e.timeSec >= CS_MIN_SEC && e.timeSec <= CS_MAX_SEC).length;
    return {
      available: false,
      csMetersPerSec: null,
      csPaceSecPerKm: null,
      dPrimeMeters: null,
      rSquared: null,
      n: inBand,
      confidence: "low",
      interpretation:
        "Not enough efforts across the 2–30 min range to separate aerobic ceiling from anaerobic reserve.",
      evidence: [],
      limitations: [
        inBand < 3
          ? `Only ${inBand} effort${inBand === 1 ? "" : "s"} in the 2–30 min window (need ≥3 spread across durations).`
          : "Efforts are too clustered in duration for a stable critical-speed line.",
      ],
    };
  }

  const csPace = 1000 / fit.csMetersPerSec;
  const confidence = csConfidence(fit.n, fit.rSquared);

  const evidence = [
    `Fitted ${fit.n} best efforts (2–30 min) to distance = CS·t + D′, R²=${fit.rSquared.toFixed(2)}.`,
    `Critical speed ${paceStr(csPace)} — the pace your aerobic system can hold with fatigue held roughly steady.`,
    `Anaerobic reserve D′ ≈ ${Math.round(fit.dPrimeMeters)} m — the distance bank you can spend above critical speed.`,
  ];

  const limitations: string[] = [];
  if (confidence === "low") {
    limitations.push("Few or noisy efforts — treat CS and D′ as directional, not precise.");
  }
  if (fit.dPrimeMeters < 50) {
    limitations.push(
      "Very small D′ — likely a shortage of short, fast efforts; add reps under ~3 min to sharpen it.",
    );
  }

  return {
    available: true,
    csMetersPerSec: Math.round(fit.csMetersPerSec * 1000) / 1000,
    csPaceSecPerKm: Math.round(csPace),
    dPrimeMeters: Math.round(fit.dPrimeMeters),
    rSquared: fit.rSquared,
    n: fit.n,
    confidence,
    interpretation: `Critical speed ${paceStr(csPace)}, anaerobic reserve ≈ ${Math.round(fit.dPrimeMeters)} m.`,
    evidence,
    limitations,
  };
}

/** Extra % of time added per doubling of distance for `exponent` vs `reference`. */
function extraFadePerDoubling(exponent: number, reference: number): number {
  const pct = (Math.pow(2, exponent) / Math.pow(2, reference) - 1) * 100;
  return Math.round(pct * 10) / 10;
}

function frConfidence(n: number, rSquared: number): "low" | "medium" | "high" {
  if (n >= 6 && rSquared >= 0.9) return "high";
  if (n >= 4 && rSquared >= 0.75) return "medium";
  return "low";
}

/**
 * Assess personalized fatigue-resistance from the power-law fit of the athlete's
 * efforts. The exponent is the metric; the reference contextualizes it.
 */
export function assessFatigueResistance(efforts: EffortPoint[]): FatigueResistanceAssessment {
  const ref = RIEGEL_REFERENCE_EXPONENT;
  const fit = fitPowerLawRegression(efforts);
  if (!fit) {
    return {
      available: false,
      exponent: null,
      referenceExponent: ref,
      extraFadePerDoublingPct: null,
      rSquared: null,
      n: efforts.length,
      trend: null,
      trendDetail: null,
      confidence: "low",
      interpretation:
        "Not enough efforts across distances to fit a personal fatigue-resistance curve.",
      evidence: [],
      limitations: ["Need ≥3 efforts spread across 3–30 km for a power-law fit."],
    };
  }

  const exponent = Math.round(fit.exponent * 1000) / 1000;
  const extra = extraFadePerDoubling(exponent, ref);
  const confidence = frConfidence(fit.pointCount, fit.rSquared);

  // Trend: fit the exponent on the recent half vs the older half of efforts.
  let trend: FatigueResistanceAssessment["trend"] = null;
  let trendDetail: string | null = null;
  const byDate = [...efforts].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(byDate.length / 2);
  const olderFit = fitPowerLawRegression(byDate.slice(0, mid));
  const recentFit = fitPowerLawRegression(byDate.slice(mid));
  if (olderFit && recentFit) {
    const delta = recentFit.exponent - olderFit.exponent;
    if (delta <= -0.02) {
      trend = "improving";
      trendDetail = `Exponent eased ${olderFit.exponent.toFixed(2)} → ${recentFit.exponent.toFixed(2)} — you're fading less over distance.`;
    } else if (delta >= 0.02) {
      trend = "declining";
      trendDetail = `Exponent rose ${olderFit.exponent.toFixed(2)} → ${recentFit.exponent.toFixed(2)} — fade over distance has grown.`;
    } else {
      trend = "stable";
      trendDetail = `Exponent held near ${recentFit.exponent.toFixed(2)}.`;
    }
  }

  const vsRef =
    exponent > ref + 0.005
      ? `above the ~${ref} reference — you fade ${extra > 0 ? `~${extra}%` : "slightly"} more per doubling of distance`
      : exponent < ref - 0.005
        ? `below the ~${ref} reference — you hold pace ${Math.abs(extra)}% better per doubling than the textbook runner`
        : `right at the ~${ref} reference`;

  const evidence = [
    `Power-law fit through ${fit.pointCount} efforts (R²=${fit.rSquared.toFixed(2)}): time ∝ distance^${exponent.toFixed(2)}.`,
    `Your exponent ${exponent.toFixed(2)} is ${vsRef}.`,
    ...(trendDetail ? [trendDetail] : []),
  ];

  const limitations: string[] = [];
  if (confidence === "low") {
    limitations.push("Sparse or noisy efforts — the exponent is directional, not precise.");
  }
  if (trend == null) {
    limitations.push("Not enough efforts in each period to establish a trend yet.");
  }

  return {
    available: true,
    exponent,
    referenceExponent: ref,
    extraFadePerDoublingPct: extra,
    rSquared: fit.rSquared,
    n: fit.pointCount,
    trend,
    trendDetail,
    confidence,
    interpretation: `Fatigue-resistance exponent ${exponent.toFixed(2)} (${vsRef}).`,
    evidence,
    limitations,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Per-run durability: 100 minus penalties for HR drift and late pace fade. */
function runDurabilityScore(hrDriftPct: number | null, lateFadePct: number | null): number | null {
  if (hrDriftPct == null && lateFadePct == null) return null;
  let score = 100;
  if (hrDriftPct != null && hrDriftPct > 0) score -= clamp(hrDriftPct, 0, 20) * 2.5;
  if (lateFadePct != null && lateFadePct > 0) score -= clamp(lateFadePct, 0, 15) * 3;
  return Math.round(clamp(score, 0, 100));
}

/** A run long enough for durability to reveal itself. */
function isEnduranceRun(run: RunActivity): boolean {
  return run.distanceM >= 10000 || (run.movingSec ?? 0) >= 2400;
}

interface DurabilitySample {
  date: string;
  score: number;
  hrDriftPct: number | null;
  lateFadePct: number | null;
}

/**
 * Assess durability — efficiency/pace held deep into endurance runs. See the
 * module header for how this differs from the forecaster's durability model.
 */
export function assessDurability(
  runs: RunActivity[],
  fitDetails: FitRunDetail[],
): DurabilityScoreAssessment {
  const fitById = new Map(fitDetails.map((f) => [f.activityId, f]));

  const samples: DurabilitySample[] = [];
  for (const run of runs) {
    if (!isEnduranceRun(run)) continue;
    const fit = fitById.get(run.id);
    if (!fit) continue;
    const hrDriftPct = fit.hrDriftPct;
    const lateFadePct = computeLateFadePct(fit);
    const score = runDurabilityScore(hrDriftPct, lateFadePct);
    if (score == null) continue;
    samples.push({ date: run.date, score, hrDriftPct, lateFadePct });
  }

  if (samples.length < 2) {
    return {
      available: false,
      score: null,
      label: null,
      decouplingMedianPct: null,
      lateFadeMedianPct: null,
      trend: null,
      sampleSize: samples.length,
      confidence: "low",
      interpretation:
        "Not enough long runs with stream data to measure how you hold up under fatigue.",
      evidence: [],
      limitations: [
        "Durability needs ≥2 endurance runs (≥10 km or ≥40 min) with FIT pace/HR streams.",
      ],
    };
  }

  const byDate = [...samples].sort((a, b) => a.date.localeCompare(b.date));
  const score = Math.round(median(byDate.map((s) => s.score)));

  const drifts = byDate.map((s) => s.hrDriftPct).filter((v): v is number => v != null);
  const fades = byDate.map((s) => s.lateFadePct).filter((v): v is number => v != null);
  const decouplingMedianPct = drifts.length ? Math.round(median(drifts) * 10) / 10 : null;
  const lateFadeMedianPct = fades.length ? Math.round(median(fades) * 10) / 10 : null;

  let label: DurabilityScoreAssessment["label"] = "moderate";
  if (score >= 72) label = "strong";
  else if (score < 48) label = "weak";

  // Trend: recent half vs older half median score.
  let trend: DurabilityScoreAssessment["trend"] = null;
  const mid = Math.floor(byDate.length / 2);
  if (mid >= 1 && byDate.length - mid >= 1 && byDate.length >= 4) {
    const olderMed = median(byDate.slice(0, mid).map((s) => s.score));
    const recentMed = median(byDate.slice(mid).map((s) => s.score));
    const delta = recentMed - olderMed;
    if (delta >= 6) trend = "improving";
    else if (delta <= -6) trend = "declining";
    else trend = "stable";
  }

  const confidence: "low" | "medium" | "high" =
    samples.length >= 6 ? "high" : samples.length >= 3 ? "medium" : "low";

  const evidence: string[] = [
    `Durability ${score}/100 (${label}) across ${samples.length} endurance runs with streams.`,
  ];
  if (decouplingMedianPct != null) {
    evidence.push(
      `Median HR drift ${decouplingMedianPct > 0 ? "+" : ""}${decouplingMedianPct}% (first→second half).`,
    );
  }
  if (lateFadeMedianPct != null) {
    evidence.push(
      `Median late-run pace fade ${lateFadeMedianPct > 0 ? "+" : ""}${lateFadeMedianPct}% (last third vs first).`,
    );
  }
  if (trend && trend !== "stable") {
    evidence.push(`Durability is ${trend} across your recent vs earlier long runs.`);
  }

  const limitations: string[] = [];
  if (confidence === "low") {
    limitations.push("Few endurance runs with streams — treat the score as directional.");
  }
  if (trend == null) {
    limitations.push("Not enough long runs across periods to establish a durability trend.");
  }

  return {
    available: true,
    score,
    label,
    decouplingMedianPct,
    lateFadeMedianPct,
    trend,
    sampleSize: samples.length,
    confidence,
    interpretation: `Durability ${score}/100 — ${label} at holding efficiency and pace deep into long runs.`,
    evidence,
    limitations,
  };
}

/** Compute the athlete's physiology profile from runs + FIT detail. */
export function computePhysiology(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = [],
): AthletePhysiology {
  const prs = findPersonalRecords(runs, fitDetails);
  const efforts = collectEffortPoints(runs, fitDetails, prs);
  return {
    criticalSpeed: assessCriticalSpeed(efforts),
    fatigueResistance: assessFatigueResistance(efforts),
    durability: assessDurability(runs, fitDetails),
  };
}
