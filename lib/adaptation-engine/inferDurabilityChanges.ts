import type { DashboardInsights } from "@/lib/analytics";
import type { AdaptationSignal } from "./types";

export function inferDurabilityChanges(analytics: DashboardInsights): AdaptationSignal[] {
  const blocks = analytics.trainingBlocks;
  if (blocks.length < 2) return [];

  const last = blocks[blocks.length - 1];
  const out: AdaptationSignal[] = [];

  if (last.longestRunKm >= 18) {
    out.push({
      id: "durability-long-run",
      category: "durability",
      statement: `Recent block includes ${last.longestRunKm} km long run — durability stimulus present`,
      confidence: "low",
      supportingEvidence: [
        `Block ${last.label}: ${last.distanceKm} km`,
        `Longest ${last.longestRunKm} km`,
      ],
      contradictoryEvidence: [],
      stability: "emerging",
    });
  }

  return out;
}
