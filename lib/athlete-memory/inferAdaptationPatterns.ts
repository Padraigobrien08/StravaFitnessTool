import type { DashboardInsights } from "@/lib/analytics";
import { createBelief } from "./beliefUtils";
import type { AthleteBelief } from "./types";

export function inferAdaptationPatterns(analytics: DashboardInsights): AthleteBelief[] {
  const out: AthleteBelief[] = [];

  if (analytics.efficiencySummary.trend === "improving") {
    out.push(
      createBelief({
        id: "adapt-efficiency-up",
        category: "adaptation",
        statement:
          "Aerobic efficiency appears to improve during stretches of stable volume and consistent easy running.",
        evidence: [
          "Efficiency trend: improving",
          ...(analytics.efficiencyMoM.narrative ? [analytics.efficiencyMoM.narrative] : []),
          `Comparable runs: ${analytics.efficiencyMoM.comparableCount}`,
        ].filter(Boolean),
        confidence: analytics.efficiencyMoM.comparableCount >= 6 ? "medium" : "low",
        recommendedUse:
          "Favour aerobic rhythm and protect improving trend with polarized easy days.",
      }),
    );
  }

  if (analytics.efficiencySummary.trend === "declining") {
    out.push(
      createBelief({
        id: "adapt-efficiency-down",
        category: "adaptation",
        statement:
          "Aerobic efficiency may be flattening: extra fatigue or intensity may be masking adaptation.",
        evidence: [
          "Efficiency trend: declining",
          `Freshness ${Math.round(analytics.fatigue.freshness)}`,
        ],
        confidence: "low",
        recommendedUse: "Prioritize recovery and easy volume before adding quality.",
      }),
    );
  }

  if (analytics.bestBlock && analytics.trainingBlocks.length >= 2) {
    const recent = analytics.trainingBlocks[analytics.trainingBlocks.length - 1];
    out.push(
      createBelief({
        id: "adapt-best-block",
        category: "adaptation",
        statement:
          "Historically, your strongest adaptation windows coincide with your highest stable-volume blocks.",
        evidence: [
          `Best block: ${analytics.bestBlock.label} (${analytics.bestBlock.distanceKm} km)`,
          `Recent block: ${recent.label} (${recent.distanceKm} km)`,
        ],
        confidence: analytics.dataConfidence === "high" ? "medium" : "low",
        recommendedUse:
          "When building, replicate the rhythm of past strong blocks rather than spiking volume abruptly.",
      }),
    );
  }

  const prRecent = analytics.prTimeline.filter((p) => p.isNewPr).slice(-1)[0];
  if (prRecent) {
    out.push(
      createBelief({
        id: "adapt-pr-breakthrough",
        category: "adaptation",
        statement:
          "Recent breakthrough efforts suggest the current block is translating to performance when freshness is adequate.",
        evidence: [`New ${prRecent.label} PR`, `Consistency: ${analytics.consistencyScore.label}`],
        confidence: "low",
        recommendedUse:
          "Anchor confidence on recent proof efforts but avoid stacking quality immediately after.",
      }),
    );
  }

  return out;
}
