import { createHash } from "crypto";
import type { CoachingContext } from "@/lib/coaching-context";
import type {
  GenerateNextWeekPlanToolInput,
  PlanToolObservability,
  WeeklyTrainingPlan,
} from "./types";
import type { GenerateWeeklyPlanResult } from "./types";

const MAX_LOG = 20;
const planRunLog: PlanToolObservability[] = [];

export function hashCoachingContext(context: CoachingContext): string {
  const payload = {
    generatedAt: context.generatedAt,
    goal: context.goal,
    freshness: context.currentState.freshness,
    fatigue: context.currentState.fatigueState,
    windowDays: context.recentTraining.windowDays,
    runWeeks: context.recentTraining.weeks.length,
    dataQuality: context.dataQuality.activityCount,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function recordPlanRun(
  input: GenerateNextWeekPlanToolInput,
  context: CoachingContext,
  result: GenerateWeeklyPlanResult,
  opts?: {
    repairsApplied?: boolean;
    modification?: string;
    rawModelOutput?: unknown;
  },
): PlanToolObservability {
  const entry: PlanToolObservability = {
    timestamp: new Date().toISOString(),
    contextHash: hashCoachingContext(context),
    toolInput: input,
    constraintsApplied: result.guardrails.constraintNotes,
    source: result.source,
    validation: result.validation,
    repairsApplied: opts?.repairsApplied ?? result.source === "repaired",
    modification: opts?.modification,
    ...(process.env.NODE_ENV === "development"
      ? {
          dev: {
            guardrails: result.guardrails,
            validationIssues: result.validation.issues,
            integrityReport: result.integrity,
            rawModelOutput: opts?.rawModelOutput,
          },
        }
      : {}),
  };
  planRunLog.unshift(entry);
  if (planRunLog.length > MAX_LOG) planRunLog.pop();
  return entry;
}

export function getRecentPlanRuns(limit = 5): PlanToolObservability[] {
  return planRunLog.slice(0, limit);
}

export function buildPlanReplySummary(
  result: GenerateWeeklyPlanResult,
  extras?: { explanation?: string },
): string {
  const { plan } = result;
  const lines = [
    plan.summary,
    "",
    `Plan type: ${plan.planType.replace("_", " ")} (week of ${plan.weekStart})`,
    `Hard sessions: ${plan.hardSessionCount}`,
    plan.totalRunDistanceKm != null ? `Run volume: ~${plan.totalRunDistanceKm} km` : "",
    "",
    plan.rationale.primaryGoal,
  ];
  if (extras?.explanation) {
    lines.push("", extras.explanation);
  }
  return lines.filter(Boolean).join("\n");
}

export function buildExplainResponse(
  plan: WeeklyTrainingPlan,
  topic: "taper" | "plan" | "pb",
): string {
  if (topic === "taper") {
    return [
      "This week is structured as a taper because race day is near and freshness matters more than fitness gains.",
      plan.rationale.evidenceUsed.length
        ? `Evidence: ${plan.rationale.evidenceUsed.join("; ")}`
        : "",
      plan.rationale.tradeoffs.join(" "),
      "Hard sessions are capped and volume is reduced so you arrive rested — not to build new fitness.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  if (topic === "pb") {
    return [
      "Chasing a PB on taper week is higher risk: the plan prioritizes freshness over sharpening load.",
      "If you want more race-specific work, we can add a short controlled session — but that trades some freshness.",
      `Current plan confidence: ${plan.confidence}. Limitations: ${plan.limitations[0] ?? "adjust based on feel"}.`,
    ].join("\n\n");
  }
  return [
    plan.summary,
    `Primary goal: ${plan.rationale.primaryGoal}`,
    `Risks managed: ${plan.rationale.risksManaged.slice(0, 3).join("; ") || "standard load management"}`,
  ].join("\n\n");
}
