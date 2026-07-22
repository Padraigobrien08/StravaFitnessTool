import { selectRelevantBeliefs } from "@/lib/athlete-memory";
import { buildAdaptiveIntelligence, buildAdaptivePlanningNotes } from "@/lib/adaptive-intelligence";
import { buildCoachingContext } from "@/lib/coaching-context";
import type { IntelligenceContext } from "@/lib/intelligence/types";
import { computeAthleteIntelligence, resolveIntelligenceContext } from "@/lib/intelligence/service";
import { applyPlanPreferenceToGuardrails } from "./applyPlanPreference";
import { applyPlanModification } from "./modifyWeeklyPlan";
import {
  buildExplainResponse,
  buildPlanReplySummary,
  hashCoachingContext,
  recordPlanRun,
} from "./planObservability";
import type { PlanModificationKind } from "./planningIntent";
import { evaluateWeeklyPlan, repairPlanFromIntegrity } from "@/lib/recommendation-integrity";
import { repairWeeklyPlan } from "./repairWeeklyPlan";
import { validateWeeklyPlan } from "./validateWeeklyPlan";
import { computeWeeklyPlanGuardrails } from "./weeklyPlanGuardrails";
import { inferPlanHintsFromContext } from "@/lib/plan/inferPlanHintsFromContext";
import { PLAN_CONTEXT_MAX_CHARS } from "@/lib/plan/planContextConstants";
import { generateWeeklyPlanFromContext } from "./generateWeeklyPlan";
import type { GenerateNextWeekPlanToolInput, PlanToolResult, WeeklyTrainingPlan } from "./types";

export async function executeGenerateNextWeekTrainingPlan(
  ctx: IntelligenceContext,
  input: GenerateNextWeekPlanToolInput = {},
  opts?: {
    previousPlan?: WeeklyTrainingPlan;
    modification?: PlanModificationKind;
    forceFallback?: boolean;
  },
): Promise<PlanToolResult> {
  const [bundle, resolved] = await Promise.all([
    computeAthleteIntelligence(ctx),
    resolveIntelligenceContext(ctx.userId, ctx),
  ]);

  const maxKm = resolved.settings.maxWeeklyKm > 0 ? resolved.settings.maxWeeklyKm : undefined;

  const windowDays = input.windowDays ?? 21;

  const coachingContext = buildCoachingContext({
    analytics: bundle.analytics,
    quality: bundle.quality,
    runs: bundle.runs,
    fitDetails: bundle.fitDetails,
    raceGoal: resolved.raceGoal ?? null,
    maxWeeklyKm: maxKm,
    options: {
      windowDays,
      includeForecast: true,
      includeMemory: true,
    },
  });

  let guardrails = computeWeeklyPlanGuardrails(coachingContext);
  guardrails = applyPlanPreferenceToGuardrails(guardrails, input.planPreference);

  if (input.availableDays?.length) {
    guardrails.constraintNotes.push(`Train only on: ${input.availableDays.join(", ")}`);
  }
  if (input.constraints?.length) {
    guardrails.constraintNotes.push(...input.constraints);
  }

  const planningContext = input.planningContext?.trim().slice(0, PLAN_CONTEXT_MAX_CHARS);
  if (planningContext) {
    guardrails.constraintNotes.push(`Athlete planning context: ${planningContext}`);
    const hints = inferPlanHintsFromContext(planningContext);
    if (hints.notes.length) {
      guardrails.constraintNotes.push(...hints.notes);
    }
    if (hints.planTypeHint === "recovery") {
      guardrails.planTypeHint = "recovery";
      guardrails.maxHardSessions = Math.min(guardrails.maxHardSessions, 1);
      guardrails.raceWeek = false;
    }
  }

  const adaptive = buildAdaptiveIntelligence(
    bundle,
    resolved.raceGoal ?? null,
    bundle.insights,
    ctx.userId,
    { trackPrimaryRecommendation: true },
  );

  const memoryProfile = adaptive.memory;
  const memorySelection = selectRelevantBeliefs(memoryProfile, {
    coachingContext,
    goal: resolved.raceGoal ?? null,
    forPlanning: true,
    maxBeliefs: 5,
  });
  if (memorySelection.planningNotes.length) {
    guardrails.constraintNotes.push(...memorySelection.planningNotes);
  }
  const adaptiveNotes = buildAdaptivePlanningNotes({
    memory: memoryProfile,
    adaptationSignals: adaptive.adaptationSignals,
    outcomes: adaptive.recommendationOutcomes,
    raceWeek: guardrails.raceWeek,
  });
  if (adaptiveNotes.length) {
    guardrails.constraintNotes.push(...adaptiveNotes);
  }
  const fatigueBelief = memorySelection.beliefs.find((b) => b.category === "fatigue");
  if (
    fatigueBelief &&
    /hard|density|stack/i.test(fatigueBelief.statement) &&
    guardrails.maxHardSessions > 1
  ) {
    guardrails.maxHardSessions = Math.min(guardrails.maxHardSessions, 1);
  }

  if (opts?.previousPlan && opts.modification) {
    let plan = applyPlanModification(opts.previousPlan, opts.modification, guardrails, {
      availableDays: input.availableDays,
    });
    let validation = validateWeeklyPlan(plan, coachingContext, guardrails);
    if (!validation.valid) {
      plan = repairWeeklyPlan(plan, guardrails);
      validation = validateWeeklyPlan(plan, coachingContext, guardrails);
    }
    let integrity = evaluateWeeklyPlan({ plan, context: coachingContext, guardrails });
    if (!integrity.passed) {
      plan = repairPlanFromIntegrity(
        plan,
        { plan, context: coachingContext, guardrails },
        integrity,
      );
      validation = validateWeeklyPlan(plan, coachingContext, guardrails);
      integrity = evaluateWeeklyPlan({ plan, context: coachingContext, guardrails });
    }
    const result = {
      plan,
      guardrails,
      source: "repaired" as const,
      validation,
      integrity,
    };
    const observability = recordPlanRun(input, coachingContext, result, {
      modification: opts.modification,
      repairsApplied: true,
    });
    return {
      ...result,
      observability,
      replySummary: buildPlanReplySummary(result, {
        explanation: `Updated your plan (${opts.modification.replace(/_/g, " ")}).`,
      }),
    };
  }

  const genResult = await generateWeeklyPlanFromContext(coachingContext, {
    forceFallback: opts?.forceFallback,
    windowDays,
    planPreference: input.planPreference,
    availableDays: input.availableDays,
    extraConstraints: input.constraints,
    planningContext,
  });

  let plan = genResult.plan;
  if (input.availableDays?.length) {
    plan = applyPlanModification(plan, "limit_days", guardrails, {
      availableDays: input.availableDays,
    });
    const validation = validateWeeklyPlan(plan, coachingContext, guardrails);
    if (!validation.valid) {
      plan = repairWeeklyPlan(plan, guardrails);
    }
    genResult.validation = validateWeeklyPlan(plan, coachingContext, guardrails);
    genResult.plan = plan;
  }

  const observability = recordPlanRun(input, coachingContext, genResult, {
    repairsApplied: genResult.source === "repaired",
  });

  return {
    ...genResult,
    observability,
    replySummary: buildPlanReplySummary(genResult),
  };
}

export function executeExplainWeeklyPlan(
  plan: WeeklyTrainingPlan,
  topic: "taper" | "plan" | "pb",
): { explanationOnly: string; replySummary: string } {
  const explanationOnly = buildExplainResponse(plan, topic);
  return {
    explanationOnly,
    replySummary: explanationOnly,
  };
}

/** For intelligence tool envelope — includes observability block */
export function planToolPayload(result: PlanToolResult) {
  return {
    plan: result.plan,
    observability: {
      contextHash: result.observability.contextHash,
      source: result.source,
      confidence: result.plan.confidence,
      constraintsApplied: result.observability.constraintsApplied,
      evidenceUsed: result.plan.rationale.evidenceUsed,
      risksManaged: result.plan.rationale.risksManaged,
      limitations: result.plan.limitations,
      integrityPassed: result.integrity?.passed ?? true,
      integrityScore: result.integrity?.score,
      validation: {
        valid: result.validation.valid,
        issueCount: result.validation.issues.length,
      },
      repairsApplied: result.observability.repairsApplied,
    },
    replySummary: result.replySummary,
  };
}

export { hashCoachingContext };
