import type { DashboardInsights } from "@/lib/analytics";
import { createBelief } from "./beliefUtils";
import type { AthleteBelief } from "./types";

export function inferTaperResponses(
  analytics: DashboardInsights
): AthleteBelief[] {
  const out: AthleteBelief[] = [];
  const rr = analytics.raceReadiness;

  if (!rr) return out;

  if (rr.daysUntilRace <= 21 && rr.daysUntilRace >= 0) {
    const volDrop =
      analytics.previousWeek &&
      analytics.currentWeek.distanceKm <
        analytics.previousWeek.distanceKm * 0.9;

    out.push(
      createBelief({
        id: "taper-freshness-priority",
        category: "taper",
        statement:
          "Approaching race day, reducing volume and preserving freshness tends to matter more than fitness gains.",
        evidence: [
          `${rr.daysUntilRace} days to ${rr.distanceLabel}`,
          `Readiness ${rr.score}/100`,
          volDrop ? "Recent week volume is tapering" : "Race window active",
        ],
        confidence: rr.daysUntilRace <= 14 ? "medium" : "low",
        recommendedUse:
          "Race-week plans should cap hard sessions and prioritise sleep and easy rhythm.",
      })
    );
  }

  if (rr.daysUntilRace <= 7 && rr.daysUntilRace >= 0) {
    out.push(
      createBelief({
        id: "taper-race-week",
        category: "taper",
        statement:
          "Race-week taper appears to improve freshness when intensity is minimised before the event.",
        evidence: [
          `Race week: ${rr.distanceLabel}`,
          `Freshness ${Math.round(analytics.fatigue.freshness)}`,
        ],
        confidence: "low",
        recommendedUse:
          "No stacked quality — one optional sharpener at most, then race execution.",
      })
    );
  }

  return out;
}
