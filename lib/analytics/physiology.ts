import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { collectEffortPoints, type EffortPoint } from "./predictions";
import { findPersonalRecords } from "./records";

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
 * Later pillars extend AthletePhysiology with fatigue-resistance (P2) and a
 * durability score (P3).
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

export interface AthletePhysiology {
  criticalSpeed: CriticalSpeedAssessment;
}

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

/** Compute the athlete's physiology profile from runs + FIT detail. */
export function computePhysiology(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = [],
): AthletePhysiology {
  const prs = findPersonalRecords(runs, fitDetails);
  const efforts = collectEffortPoints(runs, fitDetails, prs);
  return {
    criticalSpeed: assessCriticalSpeed(efforts),
  };
}
