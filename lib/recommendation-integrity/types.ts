import type { CoachingContext } from "@/lib/coaching-context";
import type { WeeklyPlanGuardrails, WeeklyTrainingPlan } from "@/lib/ai-planning/types";

export type RecommendationIssueType =
  | "missing_evidence"
  | "contradiction"
  | "overconfidence"
  | "unsafe_progression"
  | "race_week_violation"
  | "modality_interference"
  | "unsupported_claim"
  | "medical_claim"
  | "excessive_precision";

export type IssueSeverity = "low" | "medium" | "high";

export interface RecommendationIssue {
  type: RecommendationIssueType;
  severity: IssueSeverity;
  message: string;
  evidence?: string[];
  suggestedFix: string;
}

export type IntegritySeverity = "none" | "low" | "medium" | "high";

export interface RecommendationIntegrityReport {
  passed: boolean;
  score: number;
  severity: IntegritySeverity;
  issues: RecommendationIssue[];
  requiredFixes: string[];
  warnings: string[];
}

export interface WeeklyPlanIntegrityInput {
  plan: WeeklyTrainingPlan;
  context: CoachingContext;
  guardrails: WeeklyPlanGuardrails;
}

export interface RecommendationIntegrityInput {
  text: string;
  context: CoachingContext;
  claimedConfidence?: "low" | "medium" | "medium_high" | "high";
}
