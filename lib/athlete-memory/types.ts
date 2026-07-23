export type BeliefCategory =
  "adaptation" | "fatigue" | "pacing" | "taper" | "modality" | "durability" | "recovery";

export type BeliefConfidence = "low" | "medium" | "high";

export type BeliefStability = "emerging" | "stable" | "weakening";

export type OutcomeStatus = "pending" | "supported" | "contradicted" | "inconclusive";

export interface AthleteBelief {
  id: string;
  category: BeliefCategory;
  statement: string;
  confidence: BeliefConfidence;
  evidence: string[];
  counterEvidence: string[];
  firstObserved?: string;
  lastUpdated: string;
  stability: BeliefStability;
  recommendedUse: string;
  /** Persistence: how many sessions this belief has been re-observed (>=1). */
  timesConfirmed?: number;
  /** Persistence: ISO of the most recent session that re-observed it. */
  lastConfirmed?: string;
}

export interface RecommendationOutcome {
  recommendationId: string;
  recommendation: string;
  issuedAt: string;
  expectedOutcome: string;
  observedOutcome?: string;
  status: OutcomeStatus;
  evidence: string[];
}

export interface AthleteMemoryProfile {
  generatedAt: string;
  athleteId?: string;
  adaptationPatterns: AthleteBelief[];
  fatiguePatterns: AthleteBelief[];
  pacingPatterns: AthleteBelief[];
  taperResponses: AthleteBelief[];
  modalityInteractions: AthleteBelief[];
  durabilitySignals: AthleteBelief[];
  recommendationOutcomes: RecommendationOutcome[];
}

export interface MemoryUpdateEvidence {
  observedAt: string;
  supporting?: Partial<Record<BeliefCategory, string[]>>;
  contradicting?: Partial<Record<BeliefCategory, string[]>>;
  newBeliefCandidates?: AthleteBelief[];
}

export interface RelevantMemorySelection {
  beliefs: AthleteBelief[];
  planningNotes: string[];
}
