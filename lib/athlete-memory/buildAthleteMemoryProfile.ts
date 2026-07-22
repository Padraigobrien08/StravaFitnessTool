import type { DashboardInsights } from "@/lib/analytics";
import { inferAdaptationPatterns } from "./inferAdaptationPatterns";
import { inferFatiguePatterns } from "./inferFatiguePatterns";
import { inferPacingPatterns } from "./inferPacingPatterns";
import { inferTaperResponses } from "./inferTaperResponses";
import { inferModalityInteractions } from "./inferModalityInteractions";
import { inferDurabilitySignals } from "./inferDurabilitySignals";
import { inferRecommendationOutcomes } from "./inferRecommendationOutcomes";
import type { AthleteMemoryProfile } from "./types";

export function buildAthleteMemoryProfile(
  analytics: DashboardInsights | null,
  athleteId?: string,
): AthleteMemoryProfile {
  if (!analytics || analytics.summary.runCount === 0) {
    return {
      generatedAt: new Date().toISOString(),
      athleteId,
      adaptationPatterns: [],
      fatiguePatterns: [],
      pacingPatterns: [],
      taperResponses: [],
      modalityInteractions: [],
      durabilitySignals: [],
      recommendationOutcomes: [],
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    athleteId,
    adaptationPatterns: inferAdaptationPatterns(analytics),
    fatiguePatterns: inferFatiguePatterns(analytics),
    pacingPatterns: inferPacingPatterns(analytics),
    taperResponses: inferTaperResponses(analytics),
    modalityInteractions: inferModalityInteractions(analytics),
    durabilitySignals: inferDurabilitySignals(analytics),
    recommendationOutcomes: inferRecommendationOutcomes(analytics),
  };
}
