import { describe, expect, it } from "vitest";
import { computeWeeklyPlanGuardrails } from "@/lib/ai-planning/weeklyPlanGuardrails";
import { parseWeeklyTrainingPlan } from "@/lib/ai-planning/weeklyPlanSchema";
import { repairPlanFromIntegrity } from "../repairIntegrityPlan";
import { evaluateRecommendation, evaluateWeeklyPlan } from "../index";
import { contexts, invalidLlmPlan } from "@/lib/ai-planning/__tests__/fixtures";
import { nextPlanWeekStart } from "@/lib/ai-planning/weeklyPlanGuardrails";

function guardrailsFor(ctx: ReturnType<typeof contexts.raceWeek>) {
  return computeWeeklyPlanGuardrails(ctx);
}

describe("recommendation integrity", () => {
  it("flags race-week overtraining plan", () => {
    const ctx = contexts.raceWeek();
    const g = guardrailsFor(ctx);
    const weekStart = g.weekStart;
    const raw = invalidLlmPlan(weekStart);
    const parsed = parseWeeklyTrainingPlan(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const report = evaluateWeeklyPlan({
      plan: parsed.data,
      context: ctx,
      guardrails: g,
    });
    expect(report.passed).toBe(false);
    expect(
      report.issues.some(
        (i) =>
          i.type === "race_week_violation" ||
          i.type === "unsafe_progression" ||
          i.type === "contradiction",
      ),
    ).toBe(true);
  });

  it("flags unsupported high confidence with poor data", () => {
    const ctx = contexts.lowData();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = {
      weekStart: g.weekStart,
      planType: "maintain" as const,
      summary: "Maintain fitness",
      hardSessionCount: 0,
      workouts: [
        {
          day: "Mon",
          modality: "run" as const,
          type: "easy",
          title: "Easy",
          intensity: "easy" as const,
          purpose: "Aerobic",
          constraintsApplied: [],
          reasoning: "Easy day",
        },
      ],
      rationale: {
        primaryGoal: "Stay consistent",
        evidenceUsed: ["Recent training"],
        tradeoffs: [],
        risksManaged: [],
      },
      confidence: "high" as const,
      limitations: ["Limited data"],
    };
    const report = evaluateWeeklyPlan({ plan, context: ctx, guardrails: g });
    expect(report.issues.some((i) => i.type === "overconfidence")).toBe(true);
  });

  it("flags invented HRV data", () => {
    const ctx = contexts.noGoal();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = {
      weekStart: g.weekStart,
      planType: "maintain" as const,
      summary: "HRV-driven week",
      hardSessionCount: 1,
      workouts: [],
      rationale: {
        primaryGoal: "Optimize",
        evidenceUsed: ["HRV trending up 12%: schedule hard Tuesday"],
        tradeoffs: [],
        risksManaged: [],
      },
      confidence: "medium" as const,
      limitations: ["HRV sensor"],
    };
    const report = evaluateWeeklyPlan({ plan, context: ctx, guardrails: g });
    expect(
      report.issues.some(
        (i) => i.type === "unsupported_claim" || i.message.toLowerCase().includes("hrv"),
      ),
    ).toBe(true);
  });

  it("flags hard strength near race", () => {
    const ctx = contexts.raceWeek();
    const g = guardrailsFor(ctx);
    const plan = {
      weekStart: g.weekStart,
      planType: "race_week" as const,
      summary: "Race week",
      hardSessionCount: 0,
      workouts: [
        {
          day: "Wed",
          modality: "strength" as const,
          type: "heavy",
          title: "Heavy max strength",
          intensity: "hard" as const,
          purpose: "Peak strength",
          constraintsApplied: [],
          reasoning: "Get strong before Sunday race",
        },
      ],
      rationale: {
        primaryGoal: "Race",
        evidenceUsed: ["5 days to race", "Freshness moderate"],
        tradeoffs: [],
        risksManaged: [],
      },
      confidence: "medium" as const,
      limitations: [],
    };
    const report = evaluateWeeklyPlan({ plan, context: ctx, guardrails: g });
    expect(report.issues.some((i) => i.type === "race_week_violation")).toBe(true);
  });

  it("flags excessive volume jump", () => {
    const ctx = contexts.noGoal();
    const g = computeWeeklyPlanGuardrails(ctx);
    const recent = ctx.recentTraining.weeks.at(-1)?.runDistanceKm ?? 30;
    const plan = {
      weekStart: g.weekStart,
      planType: "build" as const,
      summary: "Big jump",
      hardSessionCount: 1,
      totalRunDistanceKm: recent * 1.5,
      workouts: [],
      rationale: {
        primaryGoal: "Build",
        evidenceUsed: [`Last week ${recent} km`, "Fatigue state neutral"],
        tradeoffs: [],
        risksManaged: [],
      },
      confidence: "medium" as const,
      limitations: ["Volume increase"],
    };
    const report = evaluateWeeklyPlan({ plan, context: ctx, guardrails: g });
    expect(report.issues.some((i) => i.type === "unsafe_progression")).toBe(true);
  });

  it("flags missing or generic evidence", () => {
    const ctx = contexts.hybrid();
    const g = computeWeeklyPlanGuardrails(ctx);
    const weekStart = nextPlanWeekStart();
    const raw = invalidLlmPlan(weekStart);
    const parsed = parseWeeklyTrainingPlan({
      ...raw,
      rationale: {
        primaryGoal: "Train",
        evidenceUsed: ["your data", "training history"],
        tradeoffs: [],
        risksManaged: [],
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const report = evaluateWeeklyPlan({
      plan: parsed.data,
      context: ctx,
      guardrails: g,
    });
    expect(report.issues.some((i) => i.type === "missing_evidence")).toBe(true);
  });

  it("flags generic plan summary with rich history", () => {
    const ctx = contexts.hybrid();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = {
      weekStart: g.weekStart,
      planType: "build" as const,
      summary: "Train hard",
      hardSessionCount: 1,
      workouts: [],
      rationale: {
        primaryGoal: "Build",
        evidenceUsed: [
          `Last week ${ctx.recentTraining.weeks.at(-1)?.runDistanceKm ?? 40} km`,
          "Fatigue state neutral",
        ],
        tradeoffs: [],
        risksManaged: [],
      },
      confidence: "medium" as const,
      limitations: ["Standard"],
    };
    const report = evaluateWeeklyPlan({ plan, context: ctx, guardrails: g });
    expect(report.issues.some((i) => i.message.toLowerCase().includes("generic"))).toBe(true);
  });

  it("flags contradictory strength advice", () => {
    const ctx = contexts.hybrid();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = {
      weekStart: g.weekStart,
      planType: "maintain" as const,
      summary:
        "Strength is beneficial for running and strength is interfering with your key runs this week.",
      hardSessionCount: 1,
      workouts: [],
      rationale: {
        primaryGoal: "Balance",
        evidenceUsed: ["Strength supports durability", "Interference risk elevated"],
        tradeoffs: [],
        risksManaged: [],
      },
      confidence: "medium" as const,
      limitations: [],
    };
    const report = evaluateWeeklyPlan({ plan, context: ctx, guardrails: g });
    expect(report.issues.some((i) => i.type === "contradiction")).toBe(true);
  });

  it("flags medical claims in recommendation text", () => {
    const ctx = contexts.lowData();
    const report = evaluateRecommendation({
      text: "You are diagnosed with overtraining and medically ready to race.",
      context: ctx,
      claimedConfidence: "high",
    });
    expect(report.issues.some((i) => i.type === "medical_claim")).toBe(true);
    expect(report.passed).toBe(false);
  });

  it("repair improves integrity score", () => {
    const ctx = contexts.raceWeek();
    const g = guardrailsFor(ctx);
    const raw = invalidLlmPlan(g.weekStart);
    const parsed = parseWeeklyTrainingPlan(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const before = evaluateWeeklyPlan({
      plan: parsed.data,
      context: ctx,
      guardrails: g,
    });
    const repaired = repairPlanFromIntegrity(
      parsed.data,
      {
        plan: parsed.data,
        context: ctx,
        guardrails: g,
      },
      before,
    );
    const after = evaluateWeeklyPlan({
      plan: repaired,
      context: ctx,
      guardrails: g,
    });
    expect(after.score).toBeGreaterThanOrEqual(before.score);
    expect(repaired.rationale.evidenceUsed.length).toBeGreaterThan(0);
  });
});
