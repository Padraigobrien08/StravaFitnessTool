export type ExecutionQuality = "poor" | "moderate" | "strong" | "excellent";
export type FatigueCost = "low" | "moderate" | "high";
export type GoalAlignment = "weak" | "moderate" | "strong";
export type SessionConfidence = "low" | "medium" | "high";

export interface SessionIntelligence {
  sessionId: string;
  executionQuality: ExecutionQuality;
  likelyAdaptations: string[];
  fatigueCost: FatigueCost;
  pacingAssessment: string;
  hrAssessment?: string;
  historicalComparison?: string;
  goalAlignment: GoalAlignment;
  recommendationImpact?: string;
  evidence: string[];
  confidence: SessionConfidence;
  narrative: string;
}
