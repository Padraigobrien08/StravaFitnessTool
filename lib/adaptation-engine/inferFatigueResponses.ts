import type { DashboardInsights } from "@/lib/analytics";
import type { AdaptationSignal } from "./types";

export function inferFatigueResponses(analytics: DashboardInsights): AdaptationSignal[] {
  const out: AdaptationSignal[] = [];

  if (analytics.fatigue.tsb < -15) {
    out.push({
      id: "fatigue-deep-negative-tsb",
      category: "freshness",
      statement: "Deep negative TSB suggests accumulated fatigue may suppress quality",
      confidence: "medium",
      supportingEvidence: [`TSB ${Math.round(analytics.fatigue.tsb)}`, analytics.fatigue.label],
      contradictoryEvidence: [],
      stability: "emerging",
    });
  }

  if (analytics.fatigue.freshness >= 65 && analytics.fatigue.tsb > 0) {
    out.push({
      id: "fatigue-positive-balance",
      category: "freshness",
      statement: "Load balance appears to support freshness for quality sessions",
      confidence: "low",
      supportingEvidence: [
        `Freshness ${Math.round(analytics.fatigue.freshness)}`,
        `TSB +${Math.round(analytics.fatigue.tsb)}`,
      ],
      contradictoryEvidence: [],
      stability: "emerging",
    });
  }

  return out;
}
