import type { DashboardInsights } from "@/lib/analytics";
import { RACE_READINESS_CONFIG } from "@/lib/analytics/readiness";
import { createBelief } from "./beliefUtils";
import type { AthleteBelief } from "./types";

export function inferPacingPatterns(analytics: DashboardInsights): AthleteBelief[] {
  const out: AthleteBelief[] = [];
  const longest =
    analytics.raceReadiness?.longestRunKm ?? analytics.halfMarathonReadiness.longestRunKm;

  if (analytics.summary.runCount >= 8 && longest > 0 && longest < 18) {
    out.push(
      createBelief({
        id: "pace-late-fade",
        category: "pacing",
        statement:
          "When long-run frequency drops, late-run pace often softens past ~15 km — even pacing early matters.",
        evidence: [
          `Longest recent run ${longest} km`,
          `${analytics.summary.runCount} runs in history`,
        ],
        confidence: "medium",
        counterEvidence: longest >= 18 ? ["Recent long runs exceed 18 km"] : [],
        recommendedUse:
          "In race prep, prioritise even early pacing and regular long-run touchpoints.",
      }),
    );
  }

  const consensus = analytics.racePredictionAnalysis.consensus[0];
  if (consensus && analytics.raceReadiness) {
    const dist = RACE_READINESS_CONFIG[analytics.raceReadiness.distance];
    out.push(
      createBelief({
        id: "pace-race-anchor",
        category: "pacing",
        statement:
          "Race-day pacing should anchor to recent proof efforts rather than aspirational splits.",
        evidence: [
          `${consensus.label} anchor: ${consensus.distanceKm} km effort`,
          `Prediction confidence: ${analytics.racePredictionAnalysis.confidence}`,
        ],
        confidence: analytics.racePredictionAnalysis.confidence === "high" ? "medium" : "low",
        recommendedUse: `Target even effort for ${dist.label}; adjust by freshness on race week.`,
      }),
    );
  }

  if (analytics.consistencyScore.overall >= 70) {
    out.push(
      createBelief({
        id: "pace-consistency",
        category: "pacing",
        statement:
          "Consistent weekly rhythm supports predictable pacing — erratic weeks correlate with volatile sessions.",
        evidence: [
          analytics.consistencyScore.label,
          `Score ${analytics.consistencyScore.overall}/100`,
        ],
        confidence: "low",
        recommendedUse: "Maintain regular run frequency before chasing pace breakthroughs.",
      }),
    );
  }

  return out;
}
