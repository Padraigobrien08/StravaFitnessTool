import { predictRaceTime } from "@/lib/analytics/records";
import {
  buildCapabilityModelEstimates,
  computeWeightedCapability,
} from "./capabilityModels";
import { buildContributors } from "./contributionModel";
import { assessDurability } from "./durabilityModel";
import { assessExecution } from "./executionModel";
import { assessFreshness } from "./freshnessModel";
import { buildForecastObservability } from "./forecastObservability";
import type { RaceForecastInput, RaceForecastV2 } from "./forecastTypes";
import { buildScenarios } from "./scenarioModel";
import { assessSpecificity } from "./specificityModel";
import {
  buildPredictionInterval,
  buildUncertaintyAssessment,
} from "./uncertaintyModel";

const DISTANCE_LABELS: Record<string, string> = {
  "5k": "5K",
  "10k": "10K",
  hm: "Half marathon",
  marathon: "Marathon",
};

function distanceLabel(input: RaceForecastInput): string {
  if (input.goal.distanceKey && DISTANCE_LABELS[input.goal.distanceKey]) {
    return DISTANCE_LABELS[input.goal.distanceKey];
  }
  const km = input.goal.distanceMeters / 1000;
  if (Math.abs(km - 5) < 0.3) return "5K";
  if (Math.abs(km - 10) < 0.3) return "10K";
  if (Math.abs(km - 21.1) < 0.5) return "Half marathon";
  if (Math.abs(km - 42.2) < 0.5) return "Marathon";
  return `${km.toFixed(1)} km`;
}

function modelAgreement(
  estimates: { predictedTimeSec: number }[],
  spreadSec: number
): RaceForecastV2["modelAgreement"] {
  if (estimates.length < 2) {
    return {
      score: 40,
      label: "low",
      spreadSec,
      explanation: "Insufficient models for agreement check.",
    };
  }
  const mean =
    estimates.reduce((s, e) => s + e.predictedTimeSec, 0) / estimates.length;
  const relSpread = mean > 0 ? spreadSec / mean : 0;
  let score = Math.round(100 - relSpread * 400);
  score = Math.max(0, Math.min(100, score));
  let label: "low" | "medium" | "high" = "medium";
  if (score >= 75) label = "high";
  else if (score < 50) label = "low";
  return {
    score,
    label,
    spreadSec,
    explanation:
      label === "high"
        ? "Capability models cluster tightly — forecast stability is higher."
        : label === "low"
          ? "Models diverge — treat the prediction interval as wider."
          : "Moderate spread across capability models.",
  };
}

function capabilityScoreFromEfforts(effortCount: number, modelCount: number): number {
  const s = 45 + effortCount * 8 + modelCount * 6;
  return Math.max(0, Math.min(100, Math.round(s)));
}

/** When a recent effort is ≥90% of race distance, cap forecast to modest extrapolation. */
function nearRaceEffortCeilingSec(
  input: RaceForecastInput,
  freshnessAdjustmentSec: number
): number | null {
  const targetKm = input.goal.distanceMeters / 1000;
  const near = input.efforts
    .filter((e) => e.distanceKm >= targetKm * 0.9)
    .sort((a, b) => a.timeSec / a.distanceKm - b.timeSec / b.distanceKm);
  if (near.length === 0) return null;

  const best = near[0]!;
  const extrapolated = predictRaceTime(
    best.distanceKm * 1000,
    best.timeSec,
    input.goal.distanceMeters
  );
  const durabilityTax =
    input.goal.distanceMeters >= 21000 ? 1.015 : 1.01;
  return Math.round(
    extrapolated * durabilityTax + Math.max(0, freshnessAdjustmentSec)
  );
}

const CONFIDENCE_LABEL_DISPLAY: Record<
  ReturnType<typeof buildUncertaintyAssessment>["confidenceLabel"],
  string
> = {
  low: "low",
  medium: "medium",
  medium_high: "medium-high",
  high: "high",
};

function buildRecommendation(
  freshness: ReturnType<typeof assessFreshness>,
  execution: ReturnType<typeof assessExecution>,
  limitations: string[],
  confidenceLabel: ReturnType<typeof buildUncertaintyAssessment>["confidenceLabel"]
): string {
  const parts: string[] = [];
  if (freshness.risks.length) {
    parts.push(
      `Preserve freshness and avoid additional hard sessions before race day. Evidence: ${freshness.evidence.slice(0, 2).join(" ")}`
    );
  } else {
    parts.push(
      `Maintain current training rhythm through race week. Evidence: ${freshness.evidence[0] ?? "Freshness neutral."}`
    );
  }
  parts.push(`Execution: ${execution.recommendation}`);
  parts.push(`Confidence: ${CONFIDENCE_LABEL_DISPLAY[confidenceLabel]}.`);
  parts.push(
    `Limitation: ${limitations[0] ?? "No sleep or HRV data available."}`
  );
  return `Recommendation: ${parts.join(" ")}`;
}

export function buildRaceForecastV2(input: RaceForecastInput): RaceForecastV2 {
  const estimates = buildCapabilityModelEstimates(input);
  const { baseTimeSec, weightedEstimates, spreadSec } = computeWeightedCapability(
    input,
    estimates
  );

  const durability = assessDurability(input);
  const freshness = assessFreshness(input);
  const specificity = assessSpecificity(input);
  const execution = assessExecution(input);

  const adjustedBase = Math.round(
    baseTimeSec * durability.timeMultiplier * specificity.timeMultiplier +
      freshness.timeAdjustmentSec
  );

  const modelTimes = weightedEstimates
    .map((e) => e.predictedTimeSec)
    .filter((t) => t > 0);
  const modelMin = modelTimes.length ? Math.min(...modelTimes) : adjustedBase;
  const modelMax = modelTimes.length ? Math.max(...modelTimes) : adjustedBase;

  const ceiling = Math.round(
    modelMax * durability.timeMultiplier * specificity.timeMultiplier +
      Math.max(0, freshness.timeAdjustmentSec) +
      90
  );
  const floor = Math.round(
    modelMin * durability.timeMultiplier * specificity.timeMultiplier +
      Math.min(0, freshness.timeAdjustmentSec) -
      30
  );

  let mostLikelyTimeSec = Math.max(60, adjustedBase);
  if (mostLikelyTimeSec > ceiling) {
    mostLikelyTimeSec = ceiling;
  } else if (mostLikelyTimeSec < floor) {
    mostLikelyTimeSec = Math.max(60, floor);
  }

  const nearRaceCap = nearRaceEffortCeilingSec(
    input,
    freshness.timeAdjustmentSec
  );
  if (nearRaceCap != null && mostLikelyTimeSec > nearRaceCap) {
    mostLikelyTimeSec = nearRaceCap;
  }
  const conservativeTimeSec = Math.round(
    mostLikelyTimeSec + execution.conservativePaddingSec
  );
  const optimisticTimeSec = Math.round(
    Math.max(60, mostLikelyTimeSec - execution.conservativePaddingSec * 0.6)
  );

  const agreement = modelAgreement(weightedEstimates, spreadSec);
  const uncertainty = buildUncertaintyAssessment(input, {
    modelSpreadSec: spreadSec,
    modelCount: weightedEstimates.length,
    agreementScore: agreement.score,
    durability,
    specificity,
    freshness,
    mostLikelyTimeSec,
  });

  const predictionIntervalSec = buildPredictionInterval(
    mostLikelyTimeSec,
    uncertainty.intervalWidthSec
  );

  const capabilityScore = capabilityScoreFromEfforts(
    input.efforts.length,
    weightedEstimates.length
  );

  const limitations = [
    ...(input.efforts.length < 3 ? ["Few race-quality efforts in history."] : []),
    ...(specificity.gaps[0] ? [specificity.gaps[0]] : []),
    "Weather and course profile not modeled.",
    "Non-run modalities affect fatigue only, not pace models.",
  ];

  const contributors = buildContributors(input, {
    capabilityScore,
    durability,
    freshness,
    specificity,
    execution,
    uncertainty,
    modelAgreementLabel: agreement.label,
    modelSpreadSec: spreadSec,
  });

  const observability = buildForecastObservability(input, {
    mostLikelyTimeSec,
    capabilityScore,
    durability,
    freshness,
    specificity,
    execution,
    uncertainty,
    weightedEstimates,
    limitations,
  });

  const scenarios = buildScenarios({
    mostLikelyTimeSec,
    conservativeTimeSec,
    optimisticTimeSec,
    execution,
    freshness,
  });

  const evidence = [
    ...durability.evidence.map((d) => ({ label: "Durability", detail: d })),
    ...specificity.evidence.map((d) => ({ label: "Specificity", detail: d })),
    ...freshness.evidence.map((d) => ({ label: "Freshness", detail: d })),
  ].slice(0, 8);

  const limitationObjs = limitations.map((l) => ({
    label: "Limitation",
    detail: l,
  }));

  let targetAnalysis: RaceForecastV2["targetAnalysis"];
  if (input.goal.targetTimeSec != null) {
    const gapSec = mostLikelyTimeSec - input.goal.targetTimeSec;
    targetAnalysis = {
      targetTimeSec: input.goal.targetTimeSec,
      gapSec,
      realistic: gapSec <= 0,
      explanation:
        gapSec <= 0
          ? "Current evidence suggests the target is within reach at most-likely execution."
          : `Target is ~${Math.round(gapSec)}s faster than most-likely forecast — would need stronger capability or durability.`,
    };
  }

  return {
    distanceMeters: input.goal.distanceMeters,
    distanceLabel: distanceLabel(input),
    capabilityBaseTimeSec: baseTimeSec,
    mostLikelyTimeSec,
    conservativeTimeSec,
    optimisticTimeSec,
    predictionIntervalSec,
    confidence: uncertainty.confidenceLabel,
    confidenceScore: uncertainty.score,
    componentScores: {
      capability: capabilityScore,
      durability: durability.score,
      freshness: freshness.score,
      specificity: specificity.score,
      execution: execution.score,
      uncertainty: uncertainty.score,
    },
    modelEstimates: weightedEstimates,
    modelAgreement: agreement,
    contributors,
    uncertaintyDrivers: uncertainty.drivers,
    observability,
    scenarios,
    evidence,
    limitations: limitationObjs,
    recommendation: buildRecommendation(
      freshness,
      execution,
      limitations,
      uncertainty.confidenceLabel
    ),
    targetAnalysis,
  };
}
