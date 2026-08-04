import type {
  DurabilityAssessment,
  ExecutionAssessment,
  ForecastModelEstimate,
  ForecastObservability,
  FreshnessAssessment,
  RaceForecastInput,
  SpecificityAssessment,
  UncertaintyAssessment,
} from "./forecastTypes";

export function buildForecastObservability(
  input: RaceForecastInput,
  opts: {
    mostLikelyTimeSec: number;
    capabilityScore: number;
    durability: DurabilityAssessment;
    freshness: FreshnessAssessment;
    specificity: SpecificityAssessment;
    execution: ExecutionAssessment;
    uncertainty: UncertaintyAssessment;
    weightedEstimates: ForecastModelEstimate[];
    limitations: string[];
  },
): ForecastObservability {
  const componentBreakdown: ForecastObservability["componentBreakdown"] = [
    {
      component: "Capability",
      score: opts.capabilityScore,
      effect: opts.capabilityScore >= 60 ? "improves" : "weakens",
      explanation: "Weighted blend of interpretable race-time models from best efforts.",
    },
    {
      component: "Durability",
      score: opts.durability.score,
      effect:
        opts.durability.label === "strong"
          ? "improves"
          : opts.durability.label === "weak"
            ? "weakens"
            : "neutral",
      explanation: opts.durability.explanation,
    },
    {
      component: "Freshness",
      score: opts.freshness.score,
      effect:
        opts.freshness.label === "fresh"
          ? "improves"
          : opts.freshness.label === "fatigued"
            ? "weakens"
            : "neutral",
      explanation: opts.freshness.evidence[0] ?? "Race-day fatigue modifier.",
    },
    {
      component: "Specificity",
      score: opts.specificity.score,
      effect:
        opts.specificity.label === "high"
          ? "improves"
          : opts.specificity.label === "low"
            ? "weakens"
            : "neutral",
      explanation: opts.specificity.evidence[0] ?? "How well training matches target distance.",
    },
    {
      component: "Execution",
      score: opts.execution.score,
      effect:
        opts.execution.fadeRisk === "low"
          ? "improves"
          : opts.execution.fadeRisk === "high"
            ? "weakens"
            : "neutral",
      explanation: opts.execution.recommendation,
    },
    {
      component: "Uncertainty",
      score: opts.uncertainty.score,
      effect: opts.uncertainty.score >= 65 ? "improves" : "weakens",
      explanation: `Prediction interval width driven by ${opts.uncertainty.drivers.length} uncertainty factor(s).`,
    },
  ];

  const modelWeights = opts.weightedEstimates.map((e) => ({
    modelName: e.modelName,
    weight: e.weight,
    reason:
      e.limitations.length > 0
        ? `${e.assumptions[0] ?? "Model fit"}: ${e.limitations[0]}`
        : (e.assumptions[0] ?? "Distance-weighted capability estimate"),
  }));

  const evidenceChain: string[] = [
    ...opts.durability.evidence.slice(0, 2),
    ...opts.specificity.evidence.slice(0, 2),
    ...opts.freshness.evidence.slice(0, 1),
    ...opts.weightedEstimates
      .slice(0, 2)
      .map((e) => `${e.modelName}: ${formatSec(e.predictedTimeSec)}`),
  ];

  // De-dupe: the same concern can surface from more than one sub-model
  // (e.g. a volume gap in both specificity.gaps and limitations).
  const warnings: string[] = [
    ...new Set([
      ...opts.durability.penalties,
      ...opts.specificity.gaps,
      ...opts.freshness.risks,
      ...opts.limitations,
    ]),
  ].slice(0, 6);

  let whyPredictionChanged: ForecastObservability["whyPredictionChanged"];
  if (input.previousMostLikelyTimeSec != null) {
    const delta = opts.mostLikelyTimeSec - input.previousMostLikelyTimeSec;
    const drivers: string[] = [];
    if (Math.abs(delta) >= 30) {
      drivers.push(
        delta < 0
          ? `Forecast moved faster by ${Math.abs(Math.round(delta))}s.`
          : `Forecast moved slower by ${Math.round(delta)}s.`,
      );
    }
    if (opts.freshness.timeAdjustmentSec !== 0) {
      drivers.push(
        `Freshness adjustment ${opts.freshness.timeAdjustmentSec > 0 ? "+" : ""}${opts.freshness.timeAdjustmentSec}s.`,
      );
    }
    if (opts.durability.timeMultiplier !== 1) {
      drivers.push(`Durability multiplier ${opts.durability.timeMultiplier.toFixed(3)}.`);
    }
    whyPredictionChanged = {
      previousPredictionSec: input.previousMostLikelyTimeSec,
      currentPredictionSec: opts.mostLikelyTimeSec,
      drivers: drivers.length ? drivers : ["Minor recalculation from updated training data."],
    };
  }

  const summary =
    `Most likely ${formatSec(opts.mostLikelyTimeSec)}: capability ${opts.capabilityScore}, ` +
    `durability ${opts.durability.label}, specificity ${opts.specificity.label}, ` +
    `confidence ${opts.uncertainty.confidenceLabel}.`;

  return {
    summary,
    whyPredictionChanged,
    componentBreakdown,
    modelWeights,
    evidenceChain,
    warnings,
  };
}

function formatSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
