import type { AthletePhysiology } from "./physiology";
import type { ConsistencyScore } from "./consistency";
import type { EfficiencyPoint } from "./efficiency";
import type { FitnessIndexPoint } from "./trainingLoad";
import type { PredictionTimelinePoint } from "./progression";
import type { RaceDistance, RaceGoal } from "./readiness";

/**
 * T1 — Capability radar (Pillar 3, targeted improvement).
 *
 * Six capability axes on a common 0–100 scale, each scored vs the athlete's OWN
 * history (percentile within their own trajectory — 50 ≈ personal baseline), so
 * the shape reads "where am I strong / weak *for me*." Passthrough axes that are
 * already 0–100 (durability, consistency) keep their native scale.
 *
 * A per-goal **demand profile** weights how much each axis matters for the
 * target race distance; the biggest limiter is the axis that both matters for
 * the race and is weakest — `demandImportance × (100 − score)`. This is the
 * diagnosis half of diagnosis → prescription (T2).
 *
 * Glass-box: every axis carries its derivation basis, confidence, and the radar
 * reports its own limitations rather than inventing axes it can't support.
 */

export type CapabilityAxisKey =
  "aerobic_base" | "threshold" | "top_end_speed" | "durability" | "economy" | "consistency";

export interface CapabilityAxis {
  key: CapabilityAxisKey;
  label: string;
  /** 0–100 vs the athlete's own history (50 ≈ personal baseline). */
  score: number;
  /** How the score was derived. */
  basis: string;
  /** 0–1 importance for the goal distance; null when no goal is set. */
  demandImportance: number | null;
  isLimiter: boolean;
  confidence: "low" | "medium" | "high";
  evidence: string;
}

export interface CapabilityRadar {
  available: boolean;
  axes: CapabilityAxis[];
  goalDistanceLabel: string | null;
  biggestLimiter: CapabilityAxis | null;
  interpretation: string;
  evidence: string[];
  limitations: string[];
}

export interface CapabilityRadarInputs {
  physiology: AthletePhysiology;
  consistencyScore: ConsistencyScore;
  efficiencyTrend: EfficiencyPoint[];
  fitnessIndex: FitnessIndexPoint[];
  predictionTimeline: PredictionTimelinePoint[];
}

const AXIS_LABELS: Record<CapabilityAxisKey, string> = {
  aerobic_base: "Aerobic base",
  threshold: "Threshold",
  top_end_speed: "Top-end speed",
  durability: "Durability",
  economy: "Economy",
  consistency: "Consistency",
};

/**
 * Demand profile — how much each axis matters for a race distance (0–1). Shorter
 * races lean on speed/economy; longer races lean on durability/aerobic base.
 */
const DEMAND_PROFILE: Record<RaceDistance, Record<CapabilityAxisKey, number>> = {
  "5k": {
    top_end_speed: 1,
    threshold: 0.9,
    economy: 0.8,
    aerobic_base: 0.6,
    consistency: 0.5,
    durability: 0.3,
  },
  "10k": {
    threshold: 1,
    top_end_speed: 0.8,
    economy: 0.8,
    aerobic_base: 0.7,
    consistency: 0.6,
    durability: 0.5,
  },
  hm: {
    threshold: 1,
    aerobic_base: 0.9,
    economy: 0.8,
    durability: 0.8,
    consistency: 0.7,
    top_end_speed: 0.5,
  },
  marathon: {
    durability: 1,
    aerobic_base: 1,
    economy: 0.9,
    consistency: 0.8,
    threshold: 0.7,
    top_end_speed: 0.3,
  },
};

/**
 * Percentile rank (0–100) of `current` within `series` — where the athlete sits
 * in their own distribution. `higherIsBetter=false` inverts (e.g. pace/economy,
 * where a lower number is better). Needs ≥4 points to be meaningful.
 */
export function percentileVsOwnHistory(
  series: number[],
  current: number,
  higherIsBetter = true,
): number | null {
  const vals = series.filter((v) => Number.isFinite(v));
  if (vals.length < 4) return null;
  const below = vals.filter((v) => v < current).length;
  const equal = vals.filter((v) => v === current).length;
  // Mid-rank so ties land at the middle of their band.
  const pct = ((below + equal / 2) / vals.length) * 100;
  const score = higherIsBetter ? pct : 100 - pct;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function confidenceFromN(n: number): "low" | "medium" | "high" {
  if (n >= 10) return "high";
  if (n >= 6) return "medium";
  return "low";
}

/** Recent value = mean of the last `k` finite points (defaults to the last one). */
function recentMean(series: number[], k = 3): number | null {
  const vals = series.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return null;
  const tail = vals.slice(-k);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

export function computeCapabilityRadar(
  inputs: CapabilityRadarInputs,
  raceGoal: RaceGoal | null,
): CapabilityRadar {
  const { physiology, consistencyScore, efficiencyTrend, fitnessIndex, predictionTimeline } =
    inputs;
  const axes: CapabilityAxis[] = [];
  const limitations: string[] = [];

  // Aerobic base — CTL trajectory (fitness index), current vs own history.
  const ctlSeries = fitnessIndex.map((p) => p.ctl);
  const ctlCurrent = recentMean(ctlSeries, 2);
  const aerobicScore =
    ctlCurrent != null ? percentileVsOwnHistory(ctlSeries, ctlCurrent, true) : null;
  if (aerobicScore != null) {
    axes.push({
      key: "aerobic_base",
      label: AXIS_LABELS.aerobic_base,
      score: aerobicScore,
      basis: "Chronic training load (CTL) vs your own history",
      demandImportance: null,
      isLimiter: false,
      confidence: confidenceFromN(ctlSeries.length),
      evidence: `Current fitness index ${Math.round(ctlCurrent!)} — ${aerobicScore}th percentile of your history.`,
    });
  }

  // Threshold — 10K consensus prediction over time (faster = higher).
  const thrSeries = predictionTimeline
    .map((p) => p.consensus10kSec ?? p.consensusHmSec)
    .filter((v): v is number => v != null && v > 0);
  const thrCurrent = thrSeries.at(-1);
  const thrScore = thrCurrent != null ? percentileVsOwnHistory(thrSeries, thrCurrent, false) : null;
  if (thrScore != null) {
    axes.push({
      key: "threshold",
      label: AXIS_LABELS.threshold,
      score: thrScore,
      basis: "10K-equivalent pace trajectory vs your own history",
      demandImportance: null,
      isLimiter: false,
      confidence: confidenceFromN(thrSeries.length),
      evidence: physiology.thresholdEconomy.available
        ? physiology.thresholdEconomy.interpretation
        : `10K-equivalent capability at the ${thrScore}th percentile of your history.`,
    });
  }

  // Top-end speed — 5K consensus prediction over time (faster = higher).
  const speedSeries = predictionTimeline
    .map((p) => p.consensus5kSec)
    .filter((v): v is number => v != null && v > 0);
  const speedCurrent = speedSeries.at(-1);
  const speedScore =
    speedCurrent != null ? percentileVsOwnHistory(speedSeries, speedCurrent, false) : null;
  if (speedScore != null) {
    const cs = physiology.criticalSpeed;
    axes.push({
      key: "top_end_speed",
      label: AXIS_LABELS.top_end_speed,
      score: speedScore,
      basis: "5K-equivalent pace trajectory vs your own history",
      demandImportance: null,
      isLimiter: false,
      confidence: confidenceFromN(speedSeries.length),
      evidence:
        cs.available && cs.dPrimeMeters != null
          ? `5K capability at the ${speedScore}th percentile; anaerobic reserve D′ ≈ ${cs.dPrimeMeters} m.`
          : `5K-equivalent capability at the ${speedScore}th percentile of your history.`,
    });
  }

  // Durability — physiological durability score (already 0–100).
  const dur = physiology.durability;
  if (dur.available && dur.score != null) {
    axes.push({
      key: "durability",
      label: AXIS_LABELS.durability,
      score: dur.score,
      basis: "Durability score (decoupling + late-run fade)",
      demandImportance: null,
      isLimiter: false,
      confidence: dur.confidence,
      evidence: dur.interpretation,
    });
  }

  // Economy — aerobic efficiency (pace/HR), lower is better → inverted percentile.
  const effSeries = efficiencyTrend.map((p) => p.efficiency);
  const effCurrent = recentMean(effSeries, 3);
  const econScore =
    effCurrent != null ? percentileVsOwnHistory(effSeries, effCurrent, false) : null;
  if (econScore != null) {
    const te = physiology.thresholdEconomy;
    axes.push({
      key: "economy",
      label: AXIS_LABELS.economy,
      score: econScore,
      basis: "Aerobic efficiency (pace per heart-rate beat) vs your own history",
      demandImportance: null,
      isLimiter: false,
      confidence: confidenceFromN(effSeries.length),
      evidence:
        te.available && te.economyIndex != null
          ? `Grade-adjusted economy index ${te.economyIndex.toFixed(3)}${te.economyTrend ? ` and ${te.economyTrend}` : ""}.`
          : `Aerobic efficiency at the ${econScore}th percentile of your history.`,
    });
  }

  // Consistency — already a 0–100 score.
  axes.push({
    key: "consistency",
    label: AXIS_LABELS.consistency,
    score: consistencyScore.overall,
    basis: "Training consistency (frequency + volume stability + streak)",
    demandImportance: null,
    isLimiter: false,
    confidence: consistencyScore.streakWeeks >= 6 ? "high" : "medium",
    evidence: `${consistencyScore.label} — ${consistencyScore.evidence[0] ?? `${consistencyScore.streakWeeks}-week streak`}.`,
  });

  if (axes.length < 3) {
    return {
      available: false,
      axes,
      goalDistanceLabel: null,
      biggestLimiter: null,
      interpretation: "Not enough history yet to profile your capabilities across axes.",
      evidence: [],
      limitations: [
        "A capability radar needs enough run history to score at least three axes (fitness, pace trajectory, efficiency, consistency).",
      ],
    };
  }

  // Demand overlay + limiter (only with a goal).
  let goalDistanceLabel: string | null = null;
  let biggestLimiter: CapabilityAxis | null = null;
  if (raceGoal) {
    const profile = DEMAND_PROFILE[raceGoal.distance];
    goalDistanceLabel =
      raceGoal.distance === "hm" ? "Half marathon" : raceGoal.distance.toUpperCase();
    let bestKey: CapabilityAxisKey | null = null;
    let bestGap = -1;
    for (const axis of axes) {
      axis.demandImportance = profile[axis.key];
      const gap = axis.demandImportance * (100 - axis.score);
      if (gap > bestGap) {
        bestGap = gap;
        bestKey = axis.key;
      }
    }
    // Only flag a limiter when it actually matters (importance and a real gap).
    if (bestKey != null && bestGap > 5) {
      const limiter = axes.find((a) => a.key === bestKey)!;
      limiter.isLimiter = true;
      biggestLimiter = limiter;
    }
  } else {
    limitations.push(
      "No race goal set — showing capabilities vs your own history only, without a demand profile or limiter.",
    );
  }

  const lowConfidenceAxes = axes.filter((a) => a.confidence === "low").map((a) => a.label);
  if (lowConfidenceAxes.length > 0) {
    limitations.push(`Directional only (thin history): ${lowConfidenceAxes.join(", ")}.`);
  }

  const interpretation = biggestLimiter
    ? `Biggest limiter for your ${goalDistanceLabel}: ${biggestLimiter.label} (${biggestLimiter.score}/100).`
    : raceGoal
      ? `Well-rounded for your ${goalDistanceLabel} — no single axis stands out as a limiter.`
      : "Capabilities scored against your own history.";

  const strongest = [...axes].sort((a, b) => b.score - a.score)[0];
  const evidence = [
    `Strongest: ${strongest.label} (${strongest.score}/100).`,
    ...(biggestLimiter
      ? [
          `Weakest that matters for your race: ${biggestLimiter.label} (${biggestLimiter.score}/100).`,
        ]
      : []),
  ];

  return {
    available: true,
    axes,
    goalDistanceLabel,
    biggestLimiter,
    interpretation,
    evidence,
    limitations,
  };
}
