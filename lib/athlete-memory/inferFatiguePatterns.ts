import type { DashboardInsights } from "@/lib/analytics";
import { createBelief } from "./beliefUtils";
import type { AthleteBelief } from "./types";

export function inferFatiguePatterns(
  analytics: DashboardInsights
): AthleteBelief[] {
  const out: AthleteBelief[] = [];
  const { fatigue, intensityAdvice } = analytics;

  if (
    intensityAdvice.status === "too_hard" ||
    intensityAdvice.hardRunsLast14d >= 3
  ) {
    out.push(
      createBelief({
        id: "fatigue-hard-density",
        category: "fatigue",
        statement:
          "Freshness appears sensitive to hard-session density in a short window.",
        evidence: [
          `${intensityAdvice.hardRunsLast14d} hard runs in 14 days`,
          intensityAdvice.recommendations[0] ?? "Intensity stacking signal",
          `TSB ${Math.round(fatigue.tsb)}`,
        ].filter(Boolean),
        confidence:
          intensityAdvice.hardRunsLast14d >= 4 && fatigue.tsb < -10
            ? "medium"
            : "low",
        recommendedUse:
          "Space quality sessions and cap hard days when planning the next week.",
      })
    );
  }

  if (fatigue.tsb < -12) {
    out.push(
      createBelief({
        id: "fatigue-negative-tsb",
        category: "fatigue",
        statement:
          "Acute load is outpacing recovery — freshness tends to compress until volume or intensity eases.",
        evidence: [
          `TSB ${Math.round(fatigue.tsb)}`,
          `Freshness ${Math.round(fatigue.freshness)} (${fatigue.label})`,
        ],
        confidence: fatigue.tsb < -18 ? "medium" : "low",
        counterEvidence:
          fatigue.freshness >= 60 ? ["Freshness still moderate despite TSB"] : [],
        recommendedUse:
          "Bias plans toward recovery or maintenance until TSB improves.",
      })
    );
  }

  if (fatigue.freshness >= 65 && fatigue.tsb > -5) {
    out.push(
      createBelief({
        id: "fatigue-fresh-window",
        category: "fatigue",
        statement:
          "When freshness is high, quality sessions tend to be absorbable without immediate regression.",
        evidence: [
          `Freshness ${Math.round(fatigue.freshness)}`,
          `TSB ${Math.round(fatigue.tsb)}`,
        ],
        confidence: "low",
        recommendedUse:
          "Use fresh windows for one focused quality session, not stacked intensity.",
      })
    );
  }

  return out;
}
