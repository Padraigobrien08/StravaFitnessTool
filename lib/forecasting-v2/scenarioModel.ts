import type {
  ExecutionAssessment,
  ForecastScenario,
  FreshnessAssessment,
} from "./forecastTypes";

export function buildScenarios(opts: {
  mostLikelyTimeSec: number;
  conservativeTimeSec: number;
  optimisticTimeSec: number;
  execution: ExecutionAssessment;
  freshness: FreshnessAssessment;
}): ForecastScenario[] {
  const scenarios: ForecastScenario[] = [
    {
      name: "Expected",
      predictedTimeSec: opts.mostLikelyTimeSec,
      description:
        opts.freshness.label === "fresh"
          ? "Stable pacing with current freshness holding through the race."
          : "Stable pacing at projected capability with current training state.",
    },
    {
      name: "Conservative",
      predictedTimeSec: opts.conservativeTimeSec,
      description:
        "Slight fade or cautious first half — accounts for execution and durability buffers.",
    },
    {
      name: "Optimistic",
      predictedTimeSec: opts.optimisticTimeSec,
      description:
        "Freshness holds and pacing execution is strong without late fade.",
    },
  ];

  if (opts.execution.fadeRisk !== "low") {
    scenarios.push({
      name: "Fade-risk pacing",
      predictedTimeSec: Math.round(
        opts.mostLikelyTimeSec + opts.execution.conservativePaddingSec * 1.4
      ),
      description:
        "Aggressive early pace — current evidence suggests elevated second-half fade risk.",
    });
  }

  return scenarios;
}
