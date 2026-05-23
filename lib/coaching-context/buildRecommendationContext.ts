import type { CoachingRecommendationHistory } from "./types";

export function buildRecommendationContext(opts?: {
  recentRecommendations?: string[];
  observedOutcomes?: string[];
}): CoachingRecommendationHistory {
  const recent = (opts?.recentRecommendations ?? []).slice(-5);
  const outcomes = (opts?.observedOutcomes ?? []).slice(-5);
  return {
    recentRecommendations: recent,
    observedOutcomes: outcomes,
  };
}
