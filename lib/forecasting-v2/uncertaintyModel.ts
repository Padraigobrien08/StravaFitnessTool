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
  // Each driver contributes a raw seconds amount to the interval width; we scale
  // the whole width by distance/specificity at the end, then attribute the final
  // width back to the base + each driver so the decomposition reconciles.
  const raw: { driver: Omit<ForecastUncertaintyDriver, "widthSec">; rawWidth: number }[] = [];
  let score = 72;
  const baseWidthRaw = Math.max(60, opts.modelSpreadSec * 0.55);
  let width = baseWidthRaw;

  const add = (
    rawWidth: number,
    scorePenalty: number,
    driver: Omit<ForecastUncertaintyDriver, "widthSec">,
  ) => {
    score -= scorePenalty;
    width += rawWidth;
    raw.push({ driver, rawWidth });
  };

  if (input.efforts.length < 3) {
    add(45, 18, {
      label: "Few race-quality efforts",
      impact: "high",
      explanation: "Capability models rely on sparse anchors.",
    });
  }

  if (opts.modelCount < 2) {
    add(35, 12, {
      label: "Single model estimate",
      impact: "medium",
      explanation: "No cross-model agreement check possible.",
    });
  }

  if (opts.agreementScore < 55) {
    add(opts.modelSpreadSec * 0.35, 14, {
      label: "Model disagreement",
      impact: "high",
      explanation: `Spread of ${Math.round(opts.modelSpreadSec)}s across capability models.`,
    });
  }

  if (opts.specificity.label === "low") {
    add(50, 16, {
      label: "Low target specificity",
      impact: "high",
      explanation: "Anchors are far from race distance or volume support is thin.",
    });
  }

  if (opts.durability.label === "weak" && input.goal.distanceMeters >= 21000) {
    add(40, 12, {
      label: "Durability gap",
      impact: "high",
      explanation: "Long-run support may not sustain extrapolated capability.",
    });
  }

  if (opts.freshness.label === "fatigued") {
    add(25, 8, {
      label: "Fatigue / freshness instability",
      impact: "medium",
      explanation: "Race-day performance may vary with current load.",
    });
  }

  const hrCount = input.efforts.filter((e) => e.hasHr).length;
  if (hrCount === 0) {
    add(15, 6, {
      label: "Missing HR on anchors",
      impact: "low",
      explanation: "Effort quality harder to validate without heart rate.",
    });
  }

  const targetKm = input.goal.distanceMeters / 1000;
  const maxAnchor = input.efforts.reduce((m, e) => Math.max(m, e.distanceKm), 0);
  if (maxAnchor < targetKm * 0.35 && targetKm >= 15) {
    add(55, 10, {
      label: "Short-distance extrapolation",
      impact: "high",
      explanation: "Long race predicted from short anchors.",
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const distanceFactor = targetKm >= 35 ? 1.35 : targetKm >= 18 ? 1.15 : 1;
  const scale = distanceFactor * (1 + (100 - opts.specificity.score) / 200);
  const intervalWidthSec = Math.round(width * scale);
  const baseWidthSec = Math.round(baseWidthRaw * scale);
  const drivers: ForecastUncertaintyDriver[] = raw.map((r) => ({
    ...r.driver,
    widthSec: Math.round(r.rawWidth * scale),
  }));

  let confidenceLabel: UncertaintyAssessment["confidenceLabel"] = "medium";
  if (score >= 78) confidenceLabel = "high";
  else if (score >= 62) confidenceLabel = "medium_high";
  else if (score < 45) confidenceLabel = "low";

  return {
    score,
    intervalWidthSec,
    baseWidthSec,
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
