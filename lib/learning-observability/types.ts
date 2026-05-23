import type { AthleteBelief } from "@/lib/athlete-memory/types";
import type { AdaptationSignal } from "@/lib/adaptation-engine";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning";
import type { CausalExplanation } from "@/lib/causal-reasoning";

export interface BeliefConfidenceChange {
  beliefId: string;
  statement: string;
  from: string;
  to: string;
  reason: string;
  at: string;
}

export interface LearningTimelineEntry {
  at: string;
  type: "outcome" | "belief" | "adaptation" | "session";
  summary: string;
  detail?: string;
}

export interface LearningObservabilityReport {
  generatedAt: string;
  activeBeliefs: AthleteBelief[];
  adaptationSignals: AdaptationSignal[];
  recommendationOutcomes: TrackedRecommendationOutcome[];
  confidenceChanges: BeliefConfidenceChange[];
  contradictions: string[];
  uncertainties: string[];
  timeline: LearningTimelineEntry[];
  causalSnapshots: CausalExplanation[];
}
