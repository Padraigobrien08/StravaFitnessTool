import type { AthleteMemoryProfile } from "@/lib/athlete-memory/types";
import type { AdaptationSignal } from "@/lib/adaptation-engine";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning";
import type { SessionIntelligence } from "@/lib/session-intelligence";
import type { LongitudinalComparison } from "@/lib/longitudinal-analysis";
import type { CausalExplanation } from "@/lib/causal-reasoning";
import type { LearningObservabilityReport } from "@/lib/learning-observability";

export interface AdaptiveIntelligenceSnapshot {
  generatedAt: string;
  memory: AthleteMemoryProfile;
  adaptationSignals: AdaptationSignal[];
  recommendationOutcomes: TrackedRecommendationOutcome[];
  recentSessions: SessionIntelligence[];
  sessionSummary: string[];
  longitudinalComparisons: LongitudinalComparison[];
  causal: {
    readiness: CausalExplanation;
    fatigue: CausalExplanation;
  };
  recentlyLearned: string[];
  observability: LearningObservabilityReport;
  primaryRecommendation: string;
}
