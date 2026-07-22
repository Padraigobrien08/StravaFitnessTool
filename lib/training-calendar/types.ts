export type CalendarModality =
  "run" | "bike" | "swim" | "strength" | "mobility" | "recovery" | "rest" | "cross_training";

export type CalendarIntensity = "easy" | "moderate" | "hard" | "recovery" | "rest";

export type CalendarWorkoutStatus = "planned" | "completed" | "skipped" | "modified";

export type CalendarWeekSource = "ai_generated" | "fallback" | "manual";

export type CalendarConfidence = "low" | "medium" | "medium_high" | "high";

export interface CalendarWorkout {
  id: string;
  sourcePlanId?: string;
  date: string;
  day: string;
  modality: CalendarModality;
  type: string;
  title: string;
  durationMin?: number;
  distanceKm?: number;
  intensity: CalendarIntensity;
  purpose: string;
  reasoning?: string;
  constraintsApplied?: string[];
  status: CalendarWorkoutStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingCalendarWeek {
  id: string;
  weekStart: string;
  weekEnd: string;
  source: CalendarWeekSource;
  planId?: string;
  planType?: string;
  summary: string;
  workouts: CalendarWorkout[];
  evidenceUsed: string[];
  constraintsApplied: string[];
  risksManaged: string[];
  limitations: string[];
  confidence: CalendarConfidence;
  totalRunDistanceKm?: number;
  hardSessionCount?: number;
  integrityPassed?: boolean;
  integritySeverity?: "none" | "low" | "medium" | "high";
  generatedAt?: string;
  savedAt: string;
  updatedAt: string;
  /** Increments on each save to this week */
  revision?: number;
  /** Athlete narrative used when this week was generated */
  planningContext?: string;
}

export interface CalendarStorageIndex {
  version: 1;
  weeks: Record<string, TrainingCalendarWeek>;
}

export type CalendarValidationSeverity = "none" | "low" | "medium" | "high";

export interface CalendarValidationIssue {
  code: string;
  message: string;
  severity: CalendarValidationSeverity;
}

export interface CalendarValidationResult {
  valid: boolean;
  canSave: boolean;
  issues: CalendarValidationIssue[];
}
