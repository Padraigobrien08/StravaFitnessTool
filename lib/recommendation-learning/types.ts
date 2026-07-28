import type { LegFeel } from "@/lib/wellness/types";

export type OutcomeEvaluation =
  "supported" | "partially_supported" | "contradicted" | "inconclusive";

export interface TrackedRecommendationOutcome {
  recommendationId: string;
  issuedAt: string;
  evaluatedAt?: string;
  recommendation: string;
  expectedOutcome: string[];
  observedSignals: string[];
  evaluation: OutcomeEvaluation;
  confidenceBefore: number;
  confidenceAfter?: number;
  evidence: string[];
  notes?: string;
}

export interface OutcomeTrackingInput {
  recommendationId: string;
  recommendation: string;
  expectedOutcome: string[];
  issuedAt?: string;
  confidenceBefore?: number;
}

export interface EvaluateOutcomeInput {
  outcome: TrackedRecommendationOutcome;
  /** Fresh analytics snapshot at evaluation time */
  freshness?: number;
  tsb?: number;
  readinessScore?: number;
  readinessDelta?: number;
  efficiencyTrend?: "improving" | "declining" | "stable" | null;
  hardRuns14d?: number;
  priorHardRuns14d?: number;
  /** Athlete's reported leg-feel at/around evaluation time (for feel↔outcome learning). */
  legFeel?: LegFeel;
}
