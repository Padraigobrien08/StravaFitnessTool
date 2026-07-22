import type { Insight } from "@/lib/insights/types";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { AthleteIntelligenceBundle } from "./types";
import { buildAdaptiveIntelligence } from "@/lib/adaptive-intelligence";
import type { AdaptiveIntelligenceSnapshot } from "@/lib/adaptive-intelligence";

export function buildAdaptiveSnapshotFromBundle(
  bundle: AthleteIntelligenceBundle,
  raceGoal: RaceGoal | null,
  insights: Insight[] = [],
  athleteKey?: string,
): AdaptiveIntelligenceSnapshot {
  return buildAdaptiveIntelligence(
    bundle,
    raceGoal,
    insights,
    athleteKey ?? bundle.analytics.summary.runCount.toString(),
    { trackPrimaryRecommendation: false },
  );
}

export function buildAdaptiveSnapshotFromAnalytics(
  bundle: Pick<
    AthleteIntelligenceBundle,
    "analytics" | "insights" | "quality" | "runs" | "fitDetails"
  >,
  raceGoal: RaceGoal | null,
): AdaptiveIntelligenceSnapshot {
  return buildAdaptiveSnapshotFromBundle(
    {
      ...bundle,
      recentRuns: [],
    },
    raceGoal,
    bundle.insights,
  );
}
