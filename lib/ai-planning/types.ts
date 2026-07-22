import type { CoachingContext } from "@/lib/coaching-context";

export type PlannedModality =
  "run" | "bike" | "swim" | "strength" | "mobility" | "recovery" | "rest" | "cross_training";

export type PlannedIntensity = "easy" | "moderate" | "hard" | "recovery" | "rest";

export type WeeklyPlanType = "build" | "maintain" | "taper" | "recovery" | "race_week";

export type PlanConfidence = "low" | "medium" | "medium_high" | "high";

export interface PlannedWorkout {
  day: string;
  modality: PlannedModality;
  type: string;
  title: string;
  durationMin?: number;
  distanceKm?: number;
  intensity: PlannedIntensity;
  purpose: string;
  constraintsApplied: string[];
  reasoning: string;
}

export interface WeeklyPlanRationale {
  primaryGoal: string;
  evidenceUsed: string[];
  tradeoffs: string[];
  risksManaged: string[];
}

export interface WeeklyPlanAlternative {
  name: string;
  summary: string;
  changes: string[];
}

export interface WeeklyTrainingPlan {
  weekStart: string;
  planType: WeeklyPlanType;
  summary: string;
  totalRunDistanceKm?: number;
  totalTrainingMinutes?: number;
  hardSessionCount: number;
  workouts: PlannedWorkout[];
  rationale: WeeklyPlanRationale;
  confidence: PlanConfidence;
  limitations: string[];
  alternatives?: WeeklyPlanAlternative[];
}

export interface WeeklyPlanGuardrails {
  weekStart: string;
  planTypeHint: WeeklyPlanType;
  maxHardSessions: number;
  maxWeeklyRunKm: number;
  minWeeklyRunKm: number;
  maxVolumeIncreasePct: number;
  longRunMaxKm: number;
  minRestDays: number;
  minEasyDaysBetweenHard: number;
  noHardStrengthHoursBeforeRace: number;
  noHardStrengthHoursBeforeKeyRun: number;
  raceWeek: boolean;
  taperPhase: boolean;
  daysUntilRace?: number;
  avoidIntensityStacking: boolean;
  constraintNotes: string[];
  evidenceUsed: string[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface GenerateWeeklyPlanResult {
  plan: WeeklyTrainingPlan;
  guardrails: WeeklyPlanGuardrails;
  source: "llm" | "repaired" | "fallback";
  validation: ValidationResult;
  integrity?: import("@/lib/recommendation-integrity").RecommendationIntegrityReport;
}

export type PlanPreference = "conservative" | "balanced" | "aggressive";

export interface GenerateNextWeekPlanToolInput {
  goalId?: string;
  windowDays?: 14 | 21 | 28;
  planPreference?: PlanPreference;
  availableDays?: string[];
  constraints?: string[];
  /** Freeform athlete narrative for this planning cycle (e.g. post-race recovery) */
  planningContext?: string;
}

export interface PlanToolObservability {
  timestamp: string;
  contextHash: string;
  toolInput: GenerateNextWeekPlanToolInput;
  constraintsApplied: string[];
  source: GenerateWeeklyPlanResult["source"];
  validation: ValidationResult;
  repairsApplied: boolean;
  modification?: string;
  dev?: {
    guardrails?: WeeklyPlanGuardrails;
    validationIssues?: ValidationIssue[];
    integrityReport?: import("@/lib/recommendation-integrity").RecommendationIntegrityReport;
    rawModelOutput?: unknown;
  };
}

export interface PlanToolResult extends GenerateWeeklyPlanResult {
  observability: PlanToolObservability;
  replySummary: string;
  explanationOnly?: string;
}

export interface GenerateWeeklyPlanOptions {
  /** Skip LLM; use deterministic fallback only */
  forceFallback?: boolean;
  windowDays?: 14 | 21 | 28;
  planPreference?: PlanPreference;
  availableDays?: string[];
  extraConstraints?: string[];
  /** Athlete-provided narrative merged into planning prompt and guardrails */
  planningContext?: string;
  /** Modify existing plan instead of full regeneration */
  previousPlan?: WeeklyTrainingPlan;
  modification?: import("./planningIntent").PlanModificationKind;
}

export interface WeeklyPlanGenerationContext {
  coaching: CoachingContext;
  guardrails: WeeklyPlanGuardrails;
}

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
