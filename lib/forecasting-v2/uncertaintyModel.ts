import type {
  ForecastUncertaintyDriver,
  RaceForecastInput,
  UncertaintyAssessment,
} from "./forecastTypes";
import type { DurabilityAssessment } from "./forecastTypes";
import type { FreshnessAssessment } from "./forecastTypes";
import type { SpecificityAssessment } from "./forecastTypes";

export function buildUncertaintyAssessment(
  input: RaceForecastInput,
  opts: {
    modelSpreadSec: number;
    modelCount: number;
    agreementScore: number;
    durability: DurabilityAssessment;
    specificity: SpecificityAssessment;
    freshness: FreshnessAssessment;
    mostLikelyTimeSec: number;
  },
): UncertaintyAssessment {
  const drivers: ForecastUncertaintyDriver[] = [];
  let score = 72;
  let width = Math.max(60, opts.modelSpreadSec * 0.55);

  if (input.efforts.length < 3) {
    score -= 18;
    width += 45;
    drivers.push({
      label: "Few race-quality efforts",
      impact: "high",
      explanation: "Capability models rely on sparse anchors.",
    });
  }

  if (opts.modelCount < 2) {
    score -= 12;
    width += 35;
    drivers.push({
      label: "Single model estimate",
      impact: "medium",
      explanation: "No cross-model agreement check possible.",
    });
  }

  if (opts.agreementScore < 55) {
    score -= 14;
    width += opts.modelSpreadSec * 0.35;
    drivers.push({
      label: "Model disagreement",
      impact: "high",
      explanation: `Spread of ${Math.round(opts.modelSpreadSec)}s across capability models.`,
    });
  }

  if (opts.specificity.label === "low") {
    score -= 16;
    width += 50;
    drivers.push({
      label: "Low target specificity",
      impact: "high",
      explanation: "Anchors are far from race distance or volume support is thin.",
    });
  }

  if (opts.durability.label === "weak" && input.goal.distanceMeters >= 21000) {
    score -= 12;
    width += 40;
    drivers.push({
      label: "Durability gap",
      impact: "high",
      explanation: "Long-run support may not sustain extrapolated capability.",
    });
  }

  if (opts.freshness.label === "fatigued") {
    score -= 8;
    width += 25;
    drivers.push({
      label: "Fatigue / freshness instability",
      impact: "medium",
      explanation: "Race-day performance may vary with current load.",
    });
  }

  const hrCount = input.efforts.filter((e) => e.hasHr).length;
  if (hrCount === 0) {
    score -= 6;
    width += 15;
    drivers.push({
      label: "Missing HR on anchors",
      impact: "low",
      explanation: "Effort quality harder to validate without heart rate.",
    });
  }

  const targetKm = input.goal.distanceMeters / 1000;
  const maxAnchor = input.efforts.reduce((m, e) => Math.max(m, e.distanceKm), 0);
  if (maxAnchor < targetKm * 0.35 && targetKm >= 15) {
    score -= 10;
    width += 55;
    drivers.push({
      label: "Short-distance extrapolation",
      impact: "high",
      explanation: "Long race predicted from short anchors.",
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const distanceFactor = targetKm >= 35 ? 1.35 : targetKm >= 18 ? 1.15 : 1;
  const intervalWidthSec = Math.round(
    width * distanceFactor * (1 + (100 - opts.specificity.score) / 200),
  );

  let confidenceLabel: UncertaintyAssessment["confidenceLabel"] = "medium";
  if (score >= 78) confidenceLabel = "high";
  else if (score >= 62) confidenceLabel = "medium_high";
  else if (score < 45) confidenceLabel = "low";

  return {
    score,
    intervalWidthSec,
    drivers,
    confidenceLabel,
  };
}

export function buildPredictionInterval(
  centerSec: number,
  widthSec: number,
): {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
} {
  const half = widthSec / 2;
  return {
    p10: Math.round(centerSec - half * 1.35),
    p25: Math.round(centerSec - half * 0.75),
    p50: Math.round(centerSec),
    p75: Math.round(centerSec + half * 0.75),
    p90: Math.round(centerSec + half * 1.35),
  };
}
