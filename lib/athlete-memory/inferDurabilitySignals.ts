import type { DashboardInsights } from "@/lib/analytics";
import { RACE_READINESS_CONFIG } from "@/lib/analytics/readiness";
import { createBelief } from "./beliefUtils";
import type { AthleteBelief } from "./types";

export function inferDurabilitySignals(analytics: DashboardInsights): AthleteBelief[] {
  const out: AthleteBelief[] = [];
  const rr = analytics.raceReadiness;
  const longest = rr?.longestRunKm ?? analytics.halfMarathonReadiness.longestRunKm;
  const distKm = rr ? RACE_READINESS_CONFIG[rr.distance].raceDistanceKm : 21.0975;
  const longPct = distKm > 0 ? (longest / distKm) * 100 : 0;

  if (longest > 0) {
    out.push(
      createBelief({
        id: "dur-long-run",
        category: "durability",
        statement:
          longPct >= 75
            ? "Long-run exposure relative to race distance appears adequate for current goal."
            : "Long-run consistency supports durability; extending long run may still be a limiter.",
        evidence: [
          `Longest run ${longest} km (${Math.round(longPct)}% of race distance)`,
          rr ? `${rr.fourWeekVolumeKm} km / 4 weeks` : `4-week volume context available`,
        ],
        confidence: longPct >= 85 && analytics.summary.runCount >= 12 ? "medium" : "low",
        counterEvidence:
          longPct < 60 ? ["Long run still well below race-distance specificity"] : [],
        recommendedUse:
          longPct < 70
            ? "Gradually extend long run in build phases; protect with easy days after."
            : "Maintain long-run touchpoints through taper, not extensions.",
      }),
    );
  }

  const eco = analytics.trainingEcosystem;
  if (eco.scores.durabilitySupport >= 55) {
    out.push(
      createBelief({
        id: "dur-ecosystem",
        category: "durability",
        statement:
          "Cross-training and strength signals suggest supportive durability context when interference is managed.",
        evidence: [
          `Durability support score ${eco.scores.durabilitySupport}`,
          `Mobility support ${eco.scores.mobilitySupport}`,
        ],
        confidence: "low",
        recommendedUse:
          "Pair durability work with easy aerobic volume: avoid same-day hard stacks.",
      }),
    );
  }

  return out;
}
