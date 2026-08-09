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
  const baseWidthSec = Math.round(baseWidthRaw * scale);
  const drivers: ForecastUncertaintyDriver[] = raw.map((r) => ({
    ...r.driver,
    widthSec: Math.round(r.rawWidth * scale),
  }));

  let confidenceLabel: UncertaintyAssessment["confidenceLabel"] = "medium";
  if (score >= 78) confidenceLabel = "high";
  else if (score >= 62) confidenceLabel = "medium_high";
  else if (score < 45) confidenceLabel = "low";

  // The width above is driven by how much the capability models disagree. That
  // measures consensus, not accuracy: three models can agree closely and still
  // be wrong together. Backtesting the one held-out race on file put the point
  // estimate 7.5% off while this width claimed ±1%, so a floor is applied as a
  // share of the predicted time — the forecast may not imply precision the
  // engine has never demonstrated.
  //
  // These fractions are a minimum honesty guarantee, not a calibrated interval:
  // one race cannot calibrate one. Scoring more races should replace them with
  // measured quantiles. See scripts/backtest-race-forecast.mts.
  const MIN_WIDTH_FRACTION: Record<UncertaintyAssessment["confidenceLabel"], number> = {
    high: 0.08,
    medium_high: 0.1,
    medium: 0.13,
    low: 0.18,
  };
  const floorSec = Math.round(opts.mostLikelyTimeSec * MIN_WIDTH_FRACTION[confidenceLabel]);
  const computedWidthSec = Math.round(width * scale);
  const intervalWidthSec = Math.max(computedWidthSec, floorSec);

  // The decomposition shown to the athlete must add up, so when the floor binds
  // the extra width is attributed rather than appearing from nowhere — and the
  // reason it exists is worth saying out loud.
  if (intervalWidthSec > computedWidthSec) {
    drivers.push({
      widthSec: intervalWidthSec - computedWidthSec,
      label: "Unvalidated against your races",
      impact: "medium",
      explanation:
        "The models agree with each other, which is not the same as being right. This holds the band open until predictions have been scored against races you have actually run.",
    });
  }

  return {
    score,
    intervalWidthSec,
    baseWidthSec,
    drivers,
    confidenceLabel,
  };
}

/**
 * Spread `widthSec` symmetrically around the point estimate to give an inner and an
 * outer band.
 *
 * The two multipliers are shape, not statistics. `OUTER_HALF_WIDTH_FACTOR` is wider
 * than half the nominal width so the outer band is visibly the pessimistic case, and
 * `INNER_HALF_WIDTH_FACTOR` is narrower so there is a tighter corridor to talk about.
 * They were chosen to look right on a chart and have never been fitted to anything.
 *
 * This function used to return `p10/p25/p50/p75/p90`. It computes exactly what it
 * computed then; only the names changed, because the old ones claimed a distribution
 * this construction does not have. See `RaceForecastV2["predictionIntervalSec"]`.
 */
const OUTER_HALF_WIDTH_FACTOR = 1.35;
const INNER_HALF_WIDTH_FACTOR = 0.75;

export function buildPredictionInterval(
  centerSec: number,
  widthSec: number,
): {
  outerLowSec: number;
  innerLowSec: number;
  mostLikelySec: number;
  innerHighSec: number;
  outerHighSec: number;
} {
  const half = widthSec / 2;
  return {
    outerLowSec: Math.round(centerSec - half * OUTER_HALF_WIDTH_FACTOR),
    innerLowSec: Math.round(centerSec - half * INNER_HALF_WIDTH_FACTOR),
    mostLikelySec: Math.round(centerSec),
    innerHighSec: Math.round(centerSec + half * INNER_HALF_WIDTH_FACTOR),
    outerHighSec: Math.round(centerSec + half * OUTER_HALF_WIDTH_FACTOR),
  };
}
