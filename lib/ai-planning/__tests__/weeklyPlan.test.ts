import { describe, expect, it } from "vitest";
import { buildSafeFallbackWeeklyPlan } from "../buildSafeFallbackWeeklyPlan";
import { computeWeeklyPlanGuardrails } from "../weeklyPlanGuardrails";
import { validateWeeklyPlan } from "../validateWeeklyPlan";
import { repairWeeklyPlan } from "../repairWeeklyPlan";
import { parseWeeklyTrainingPlan } from "../weeklyPlanSchema";
import { generateWeeklyPlanFromContext } from "../generateWeeklyPlan";
import { contexts, invalidLlmPlan, invalidPlanMissingEvidence } from "./fixtures";

describe("weekly plan guardrails", () => {
  it("caps hard sessions in race week", () => {
    const ctx = contexts.raceWeek();
    const g = computeWeeklyPlanGuardrails(ctx);
    expect(g.maxHardSessions).toBeLessThanOrEqual(1);
    expect(g.raceWeek).toBe(true);
  });

  it("reduces volume for fatigue-heavy athlete", () => {
    const ctx = contexts.fatigueHeavy();
    const g = computeWeeklyPlanGuardrails(ctx);
    expect(g.planTypeHint).toBe("recovery");
    expect(g.maxHardSessions).toBe(0);
  });
});

describe("validateWeeklyPlan", () => {
  it("rejects excessive hard sessions", () => {
    const ctx = contexts.overloaded();
    const g = computeWeeklyPlanGuardrails(ctx);
    const bad = invalidLlmPlan(g.weekStart) as never;
    const result = validateWeeklyPlan(bad, ctx, g);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "hard_sessions")).toBe(true);
  });

  it("flags invented metrics in text", () => {
    const ctx = contexts.noGoal();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    plan.workouts[0].reasoning = "Your TSB = -25 means you must rest";
    const result = validateWeeklyPlan(plan, ctx, g);
    expect(result.issues.some((i) => i.code === "invented_metric")).toBe(true);
  });

  it("flags medical certainty language", () => {
    const ctx = contexts.noGoal();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    plan.summary = "I diagnose overtraining and you must stop all exercise";
    const result = validateWeeklyPlan(plan, ctx, g);
    expect(result.issues.some((i) => i.code === "medical_claim")).toBe(true);
  });

  it("rejects volume over cap when schema valid", () => {
    const ctx = contexts.lowData();
    const g = {
      ...computeWeeklyPlanGuardrails(ctx),
      maxWeeklyRunKm: 25,
    };
    const bad = invalidPlanMissingEvidence(g.weekStart) as never;
    const result = validateWeeklyPlan(bad, ctx, g);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) => i.code === "volume_high" || i.code === "hard_sessions"
      )
    ).toBe(true);
  });
});

describe("repairWeeklyPlan", () => {
  it("reduces hard sessions to guardrail cap", () => {
    const ctx = contexts.raceWeek();
    const g = computeWeeklyPlanGuardrails(ctx);
    const bad = invalidLlmPlan(g.weekStart) as never;
    const repaired = repairWeeklyPlan(bad, g);
    const hard = repaired.workouts.filter(
      (w) => w.modality === "run" && w.intensity === "hard"
    ).length;
    expect(hard).toBeLessThanOrEqual(g.maxHardSessions);
  });
});

describe("buildSafeFallbackWeeklyPlan", () => {
  it("builds race week plan", () => {
    const ctx = contexts.raceWeek();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    expect(["race_week", "taper"]).toContain(plan.planType);
    expect(plan.rationale.evidenceUsed.length).toBeGreaterThan(0);
    expect(plan.limitations.length).toBeGreaterThan(0);
    const v = validateWeeklyPlan(plan, ctx, g);
    expect(v.valid).toBe(true);
  });

  it("builds recovery for fatigue", () => {
    const ctx = contexts.fatigueHeavy();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    expect(plan.planType).toBe("recovery");
    expect(plan.hardSessionCount).toBe(0);
  });

  it("builds maintain plan without goal", () => {
    const ctx = contexts.noGoal();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    expect(plan.workouts.length).toBeGreaterThanOrEqual(3);
    expect(plan.summary.length).toBeGreaterThan(10);
  });

  it("handles hybrid athlete", () => {
    const ctx = contexts.hybrid();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    expect(plan.workouts.length).toBeGreaterThan(0);
  });

  it("handles low data", () => {
    const ctx = contexts.lowData();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    expect(plan.confidence).toBe("low");
    expect(plan.limitations.length).toBeGreaterThan(0);
  });
});

describe("parseWeeklyTrainingPlan", () => {
  it("parses valid structured JSON", () => {
    const ctx = contexts.noGoal();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    const parsed = parseWeeklyTrainingPlan(plan);
    expect(parsed.success).toBe(true);
  });
});

describe("generateWeeklyPlanFromContext", () => {
  it("never throws and returns fallback without API key", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = await generateWeeklyPlanFromContext(contexts.noGoal(), {
      forceFallback: true,
    });
    if (prev) process.env.OPENAI_API_KEY = prev;
    expect(result.plan.workouts.length).toBeGreaterThan(0);
    expect(["fallback", "repaired"]).toContain(result.source);
    expect(result.plan.rationale.evidenceUsed.length).toBeGreaterThan(0);
  });
});
