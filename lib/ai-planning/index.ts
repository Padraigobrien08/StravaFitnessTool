export type {
  GenerateWeeklyPlanOptions,
  GenerateWeeklyPlanResult,
  OpenAIMessage,
  PlannedIntensity,
  PlannedModality,
  PlannedWorkout,
  PlanConfidence,
  ValidationIssue,
  ValidationResult,
  WeeklyPlanAlternative,
  WeeklyPlanGuardrails,
  WeeklyPlanRationale,
  WeeklyPlanType,
  WeeklyTrainingPlan,
} from "./types";

export { buildWeeklyPlanPrompt } from "./buildWeeklyPlanPrompt";
export { buildSafeFallbackWeeklyPlan } from "./buildSafeFallbackWeeklyPlan";
export {
  generateWeeklyPlan,
  generateWeeklyPlanFromBundle,
  generateWeeklyPlanFromContext,
} from "./generateWeeklyPlan";
export { repairWeeklyPlan, stripMedicalLanguage } from "./repairWeeklyPlan";
export {
  parseWeeklyTrainingPlan,
  WEEKLY_TRAINING_PLAN_JSON_SCHEMA,
} from "./weeklyPlanSchema";
export { validateWeeklyPlan } from "./validateWeeklyPlan";
export { evaluateWeeklyPlan } from "@/lib/recommendation-integrity";
export {
  computeWeeklyPlanGuardrails,
  nextPlanWeekStart,
  DAY_ORDER,
} from "./weeklyPlanGuardrails";
export {
  classifyPlanningMessage,
  isPlanningIntent,
  isWeeklyPlanIntent,
  parseToolInputFromMessage,
  type PlanningRoute,
  type PlanModificationKind,
} from "./planningIntent";
export {
  executeGenerateNextWeekTrainingPlan,
  executeExplainWeeklyPlan,
  planToolPayload,
} from "./planTool";
export { applyPlanModification } from "./modifyWeeklyPlan";
export { getRecentPlanRuns, hashCoachingContext } from "./planObservability";
export type {
  GenerateNextWeekPlanToolInput,
  PlanPreference,
  PlanToolObservability,
  PlanToolResult,
} from "./types";

