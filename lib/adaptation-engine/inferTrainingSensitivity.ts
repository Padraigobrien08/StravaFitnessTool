import type { DashboardInsights } from "@/lib/analytics";
import type { AdaptationSignal } from "./types";

export function inferTrainingSensitivity(analytics: DashboardInsights): AdaptationSignal[] {
  const hardPct = analytics.intensityAdvice.currentEasyPct;
  const target = analytics.intensityAdvice.easyTargetPct;
  const gap = target - hardPct;

  if (gap < -8) {
    return [
      {
        id: "sensitivity-intensity-heavy",
        category: "freshness",
        statement:
          "Athlete appears sensitive to intensity-heavy weeks — freshness may drop quickly",
        confidence: analytics.summary.runCount >= 20 ? "medium" : "low",
        supportingEvidence: [
          `Easy ${Math.round(hardPct)}% vs target ${target}%`,
          `${analytics.intensityAdvice.hardRunsLast14d} hard / 14d`,
        ],
        contradictoryEvidence: [],
        stability: "emerging",
      },
    ];
  }

  if (analytics.efficiencySummary.trend === "improving" && gap >= 0) {
    return [
      {
        id: "sensitivity-stable-polarized",
        category: "threshold",
        statement: "Appears to respond well to polarized easy/hard structure with stable volume",
        confidence: "low",
        supportingEvidence: [
          "Efficiency improving",
          `Easy share near target (${Math.round(hardPct)}%)`,
        ],
        contradictoryEvidence: [],
        stability: "emerging",
      },
    ];
  }

  return [];
}
