import {
  buildCoachingContext,
  buildCoachingContextFromBundle,
} from "@/lib/coaching-context";
import type { CoachingContext } from "@/lib/coaching-context";
import type { AthleteIntelligenceBundle } from "@/lib/intelligence/types";
import type { RaceGoal } from "@/lib/analytics/readiness";
import { buildWeeklyPlanPrompt } from "./buildWeeklyPlanPrompt";
import { buildSafeFallbackWeeklyPlan } from "./buildSafeFallbackWeeklyPlan";
import { repairWeeklyPlan, stripMedicalLanguage } from "./repairWeeklyPlan";
import {
  parseWeeklyTrainingPlan,
  WEEKLY_TRAINING_PLAN_JSON_SCHEMA,
} from "./weeklyPlanSchema";
import {
  evaluateWeeklyPlan,
  repairPlanFromIntegrity,
} from "@/lib/recommendation-integrity";
import { validateWeeklyPlan } from "./validateWeeklyPlan";
import { applyPlanPreferenceToGuardrails } from "./applyPlanPreference";
import { computeWeeklyPlanGuardrails } from "./weeklyPlanGuardrails";
import { inferPlanHintsFromContext } from "@/lib/plan/inferPlanHintsFromContext";
import { PLAN_CONTEXT_MAX_CHARS } from "@/lib/plan/planContextConstants";
import type {
  GenerateWeeklyPlanOptions,
  GenerateWeeklyPlanResult,
  WeeklyTrainingPlan,
} from "./types";

async function callOpenAIWeeklyPlan(
  messages: ReturnType<typeof buildWeeklyPlanPrompt>,
  apiKey: string
): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_WEEKLY_PLAN_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      max_tokens: 4096,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: WEEKLY_TRAINING_PLAN_JSON_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI weekly plan error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string | null } }>;
  };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  return JSON.parse(content) as unknown;
}

function finalizePlan(
  plan: WeeklyTrainingPlan,
  context: CoachingContext,
  guardrails: ReturnType<typeof computeWeeklyPlanGuardrails>,
  source: GenerateWeeklyPlanResult["source"]
): GenerateWeeklyPlanResult {
  let current = stripMedicalLanguage(plan);
  let validation = validateWeeklyPlan(current, context, guardrails);
  let finalSource = source;
  let integrity = evaluateWeeklyPlan({ plan: current, context, guardrails });

  if (!validation.valid) {
    current = repairWeeklyPlan(current, guardrails);
    validation = validateWeeklyPlan(current, context, guardrails);
    finalSource = "repaired";
    integrity = evaluateWeeklyPlan({ plan: current, context, guardrails });
  }

  if (!integrity.passed) {
    current = repairPlanFromIntegrity(current, { plan: current, context, guardrails }, integrity);
    validation = validateWeeklyPlan(current, context, guardrails);
    integrity = evaluateWeeklyPlan({ plan: current, context, guardrails });
    if (finalSource === "llm") finalSource = "repaired";
  }

  if (!validation.valid || !integrity.passed) {
    current = buildSafeFallbackWeeklyPlan(context, guardrails);
    validation = validateWeeklyPlan(current, context, guardrails);
    integrity = evaluateWeeklyPlan({ plan: current, context, guardrails });
    finalSource = "fallback";
  }

  return {
    plan: current,
    guardrails,
    source: finalSource,
    validation,
    integrity,
  };
}

export async function generateWeeklyPlanFromContext(
  context: CoachingContext,
  options?: GenerateWeeklyPlanOptions
): Promise<GenerateWeeklyPlanResult> {
  let guardrails = computeWeeklyPlanGuardrails(context);
  guardrails = applyPlanPreferenceToGuardrails(
    guardrails,
    options?.planPreference
  );
  if (options?.extraConstraints?.length) {
    guardrails.constraintNotes.push(...options.extraConstraints);
  }

  const planningContext = options?.planningContext
    ?.trim()
    .slice(0, PLAN_CONTEXT_MAX_CHARS);
  if (planningContext) {
    guardrails.constraintNotes.push(
      `Athlete planning context: ${planningContext}`
    );
    const hints = inferPlanHintsFromContext(planningContext);
    if (hints.notes.length) {
      guardrails.constraintNotes.push(...hints.notes);
    }
    if (hints.planTypeHint === "recovery" && !guardrails.raceWeek) {
      guardrails.planTypeHint = "recovery";
      guardrails.maxHardSessions = Math.min(guardrails.maxHardSessions, 1);
    }
  }

  if (options?.forceFallback) {
    const plan = buildSafeFallbackWeeklyPlan(context, guardrails);
    return finalizePlan(plan, context, guardrails, "fallback");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const plan = buildSafeFallbackWeeklyPlan(context, guardrails);
    return finalizePlan(plan, context, guardrails, "fallback");
  }

  try {
    const messages = buildWeeklyPlanPrompt(context, guardrails, {
      planPreference: options?.planPreference,
      availableDays: options?.availableDays,
      extraConstraints: options?.extraConstraints,
      planningContext,
    });
    const raw = await callOpenAIWeeklyPlan(messages, apiKey);
    const parsed = parseWeeklyTrainingPlan(raw);
    if (!parsed.success) {
      const plan = buildSafeFallbackWeeklyPlan(context, guardrails);
      return finalizePlan(plan, context, guardrails, "fallback");
    }
    return finalizePlan(parsed.data, context, guardrails, "llm");
  } catch {
    const plan = buildSafeFallbackWeeklyPlan(context, guardrails);
    return finalizePlan(plan, context, guardrails, "fallback");
  }
}

export async function generateWeeklyPlanFromBundle(
  bundle: AthleteIntelligenceBundle,
  raceGoal: RaceGoal | null,
  maxWeeklyKm?: number,
  options?: GenerateWeeklyPlanOptions
): Promise<GenerateWeeklyPlanResult> {
  const context = buildCoachingContextFromBundle(
    bundle,
    raceGoal,
    maxWeeklyKm,
    {
      windowDays: options?.windowDays ?? 21,
      includeForecast: true,
      includeMemory: true,
    }
  );
  return generateWeeklyPlanFromContext(context, options);
}

export async function generateWeeklyPlan(params: {
  analytics: Parameters<typeof buildCoachingContext>[0]["analytics"];
  quality: Parameters<typeof buildCoachingContext>[0]["quality"];
  runs: Parameters<typeof buildCoachingContext>[0]["runs"];
  fitDetails?: Parameters<typeof buildCoachingContext>[0]["fitDetails"];
  raceGoal?: RaceGoal | null;
  maxWeeklyKm?: number;
  options?: GenerateWeeklyPlanOptions;
}): Promise<GenerateWeeklyPlanResult> {
  const context = buildCoachingContext({
    analytics: params.analytics,
    quality: params.quality,
    runs: params.runs,
    fitDetails: params.fitDetails,
    raceGoal: params.raceGoal ?? null,
    maxWeeklyKm: params.maxWeeklyKm,
    options: { windowDays: 21, includeForecast: true, includeMemory: true },
  });
  return generateWeeklyPlanFromContext(context, params.options);
}
