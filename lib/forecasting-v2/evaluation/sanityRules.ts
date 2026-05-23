import type { RaceForecastInput, RaceForecastV2 } from "../forecastTypes";
import type { ValidationRuleResult } from "./evaluationTypes";

function pass(
  ruleId: string,
  category: ValidationRuleResult["category"],
  message: string,
  evidence?: string[]
): ValidationRuleResult {
  return { ruleId, category, passed: true, severity: "info", message, evidence };
}

function fail(
  ruleId: string,
  category: ValidationRuleResult["category"],
  severity: ValidationRuleResult["severity"],
  message: string,
  evidence?: string[]
): ValidationRuleResult {
  return { ruleId, category, passed: false, severity, message, evidence };
}

const CONFIDENCE_RANK: Record<RaceForecastV2["confidence"], number> = {
  low: 0,
  medium: 1,
  medium_high: 2,
  high: 3,
};

function confidenceRank(c: RaceForecastV2["confidence"]): number {
  return CONFIDENCE_RANK[c];
}

export function runSanityRules(
  input: RaceForecastInput,
  forecast: RaceForecastV2
): ValidationRuleResult[] {
  const rules: ValidationRuleResult[] = [];
  const { predictionIntervalSec: iv } = forecast;
  const intervalWidth = iv.p90 - iv.p10;

  // --- Prediction range ---
  if (forecast.conservativeTimeSec >= forecast.mostLikelyTimeSec) {
    rules.push(
      pass(
        "conservative_slower_than_most_likely",
        "interval",
        "Conservative scenario is slower than most likely."
      )
    );
  } else {
    rules.push(
      fail(
        "conservative_slower_than_most_likely",
        "interval",
        "error",
        `Conservative (${forecast.conservativeTimeSec}s) is faster than most likely (${forecast.mostLikelyTimeSec}s).`,
        [`Δ ${forecast.mostLikelyTimeSec - forecast.conservativeTimeSec}s`]
      )
    );
  }

  if (forecast.optimisticTimeSec <= forecast.mostLikelyTimeSec) {
    rules.push(
      pass(
        "optimistic_faster_than_most_likely",
        "interval",
        "Optimistic scenario is faster than most likely."
      )
    );
  } else {
    rules.push(
      fail(
        "optimistic_faster_than_most_likely",
        "interval",
        "error",
        `Optimistic (${forecast.optimisticTimeSec}s) is slower than most likely (${forecast.mostLikelyTimeSec}s).`
      )
    );
  }

  const percentiles = [iv.p10, iv.p25, iv.p50, iv.p75, iv.p90];
  const ordered = percentiles.every((v, i) => i === 0 || v >= percentiles[i - 1]!);
  if (ordered) {
    rules.push(pass("percentile_ordering", "interval", "p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90."));
  } else {
    rules.push(
      fail(
        "percentile_ordering",
        "interval",
        "error",
        "Prediction interval percentiles are not monotonic.",
        percentiles.map((p) => `${p}s`)
      )
    );
  }

  if (iv.p50 === forecast.mostLikelyTimeSec) {
    rules.push(pass("p50_equals_most_likely", "interval", "p50 matches most-likely time."));
  } else {
    rules.push(
      fail(
        "p50_equals_most_likely",
        "interval",
        "warning",
        `p50 (${iv.p50}s) differs from most likely (${forecast.mostLikelyTimeSec}s).`
      )
    );
  }

  if (forecast.mostLikelyTimeSec > 0 && intervalWidth > 0) {
    rules.push(
      pass("prediction_range_nonzero", "interval", "Prediction interval has positive width.")
    );
  } else {
    rules.push(
      fail(
        "prediction_range_nonzero",
        "interval",
        "error",
        "Prediction interval width is zero or invalid."
      )
    );
  }

  // --- Model estimates ---
  const weights = forecast.modelEstimates.map((e) => e.weight);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weights.every((w) => w >= 0 && w <= 1) && weightSum > 0.01) {
    rules.push(pass("model_weights_valid", "models", "Model weights are non-negative."));
  } else {
    rules.push(
      fail(
        "model_weights_valid",
        "models",
        "error",
        "Model weights contain invalid or zero-sum values.",
        weights.map((w, i) => `${forecast.modelEstimates[i]?.modelName}: ${w}`)
      )
    );
  }

  if (forecast.modelAgreement.spreadSec >= 0) {
    rules.push(pass("model_spread_non_negative", "models", "Model spread is defined."));
  } else {
    rules.push(
      fail("model_spread_non_negative", "models", "error", "Negative model spread reported.")
    );
  }

  const times = forecast.modelEstimates.map((e) => e.predictedTimeSec).filter((t) => t > 0);
  if (times.length === 0) {
    rules.push(
      fail("model_estimates_present", "models", "error", "No positive model time estimates.")
    );
  } else {
    const min = Math.min(...times);
    const max = Math.max(...times);
    if (
      forecast.mostLikelyTimeSec >= min * 0.85 - 120 &&
      forecast.mostLikelyTimeSec <= max * 1.25 + 180
    ) {
      rules.push(
        pass(
          "most_likely_within_model_corridor",
          "models",
          "Most likely sits within capability model corridor."
        )
      );
    } else {
      rules.push(
        fail(
          "most_likely_within_model_corridor",
          "models",
          "warning",
          `Most likely ${forecast.mostLikelyTimeSec}s outside model range ${min}–${max}s.`,
          [`capability base ${forecast.capabilityBaseTimeSec}s`]
        )
      );
    }
  }

  // --- Confidence & uncertainty ---
  const specScore = forecast.componentScores.specificity;
  const specLow = specScore < 45;
  if (!specLow || intervalWidth >= 150) {
    rules.push(
      pass(
        "low_specificity_widens_uncertainty",
        "confidence",
        specLow
          ? "Low specificity is reflected in a wide interval."
          : "Specificity is adequate or interval is appropriately wide."
      )
    );
  } else {
    rules.push(
      fail(
        "low_specificity_widens_uncertainty",
        "confidence",
        "warning",
        `Low specificity (score ${specScore}) but narrow interval (${intervalWidth}s).`
      )
    );
  }

  const targetKm = input.goal.distanceMeters / 1000;
  const longest =
    input.recentBlocks[input.recentBlocks.length - 1]?.longestRunKm ?? 0;
  const marathonGap =
    targetKm >= 35 && longest < targetKm * 0.55 && forecast.componentScores.durability < 55;
  if (!marathonGap || forecast.componentScores.durability <= 65) {
    rules.push(
      pass(
        "marathon_durability_penalty",
        "components",
        marathonGap
          ? "Marathon durability concern is scored."
          : "Marathon durability penalty not required."
      )
    );
  } else {
    rules.push(
      fail(
        "marathon_durability_penalty",
        "components",
        "warning",
        `Longest run ${longest} km vs ${targetKm.toFixed(1)} km race — durability should be weaker.`
      )
    );
  }

  const freshHigh = forecast.componentScores.freshness >= 75;
  const capLow = forecast.componentScores.capability < 50;
  if (!(freshHigh && capLow && confidenceRank(forecast.confidence) >= 3)) {
    rules.push(
      pass(
        "freshness_not_auto_capability",
        "confidence",
        "High freshness does not imply high confidence with weak capability."
      )
    );
  } else {
    rules.push(
      fail(
        "freshness_not_auto_capability",
        "confidence",
        "warning",
        "High freshness paired with low capability still yields high confidence."
      )
    );
  }

  const maxAnchor = input.efforts.reduce((m, e) => Math.max(m, e.distanceKm), 0);
  const shortOnlyMarathon =
    targetKm >= 35 &&
    maxAnchor < 15 &&
    confidenceRank(forecast.confidence) >= 3;
  if (!shortOnlyMarathon) {
    rules.push(
      pass(
        "short_anchor_marathon_confidence",
        "confidence",
        "Marathon confidence is not high on short-distance evidence alone."
      )
    );
  } else {
    rules.push(
      fail(
        "short_anchor_marathon_confidence",
        "confidence",
        "error",
        `High marathon confidence with max anchor ${maxAnchor.toFixed(1)} km.`,
        [`confidence: ${forecast.confidence}`]
      )
    );
  }

  const hrBacked = input.efforts.some((e) => e.hasHr);
  const hrMissingHigh =
    !hrBacked &&
    input.efforts.length >= 2 &&
    confidenceRank(forecast.confidence) >= 3;
  if (!hrMissingHigh) {
    rules.push(
      pass(
        "missing_hr_confidence_cap",
        "data_quality",
        "Confidence is not high without HR-backed efforts."
      )
    );
  } else {
    rules.push(
      fail(
        "missing_hr_confidence_cap",
        "data_quality",
        "warning",
        "High confidence declared with no HR-backed efforts in history."
      )
    );
  }

  if (input.efforts.length < 3 && confidenceRank(forecast.confidence) <= 2) {
    rules.push(
      pass(
        "low_data_confidence_cap",
        "data_quality",
        "Sparse efforts — confidence is not high."
      )
    );
  } else if (input.efforts.length < 3) {
    rules.push(
      fail(
        "low_data_confidence_cap",
        "data_quality",
        "warning",
        `Only ${input.efforts.length} effort(s) but confidence is ${forecast.confidence}.`
      )
    );
  } else {
    rules.push(pass("low_data_confidence_cap", "data_quality", "Adequate effort history."));
  }

  const scoreGap = Math.abs(forecast.confidenceScore - uncertaintyScore(forecast));
  if (scoreGap <= 25) {
    rules.push(
      pass(
        "confidence_score_alignment",
        "confidence",
        "Confidence label aligns with uncertainty score band."
      )
    );
  } else {
    rules.push(
      fail(
        "confidence_score_alignment",
        "confidence",
        "warning",
        `confidenceScore ${forecast.confidenceScore} vs label ${forecast.confidence} may be misaligned.`,
        [`interval width ${intervalWidth}s`]
      )
    );
  }

  if (
    forecast.modelAgreement.label === "high" &&
    forecast.componentScores.specificity < 40
  ) {
    rules.push(
      fail(
        "high_agreement_low_specificity",
        "confidence",
        "warning",
        "Models agree tightly but specificity is low — agreement may reflect shared extrapolation, not target fitness.",
        [`specificity ${forecast.componentScores.specificity}`, `spread ${forecast.modelAgreement.spreadSec}s`]
      )
    );
  } else {
    rules.push(
      pass(
        "high_agreement_low_specificity",
        "confidence",
        "Model agreement is appropriate for specificity level."
      )
    );
  }

  // --- Contributors ---
  const hasNegativeDurability = forecast.contributors.negative.some(
    (c) => c.component === "durability"
  );
  if (
    forecast.componentScores.durability < 50 &&
    targetKm >= 18 &&
    hasNegativeDurability
  ) {
    rules.push(
      pass(
        "durability_contributor_consistency",
        "components",
        "Weak durability surfaces as a negative contributor."
      )
    );
  } else if (forecast.componentScores.durability < 50 && targetKm >= 18) {
    rules.push(
      fail(
        "durability_contributor_consistency",
        "components",
        "warning",
        "Low durability score without a negative durability contributor."
      )
    );
  } else {
    rules.push(
      pass(
        "durability_contributor_consistency",
        "components",
        "Durability contributor alignment not required."
      )
    );
  }

  return rules;
}

function uncertaintyScore(forecast: RaceForecastV2): number {
  return forecast.componentScores.uncertainty;
}
