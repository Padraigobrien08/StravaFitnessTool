import { describe, expect, it } from "vitest";
import { applyPlanModification } from "../modifyWeeklyPlan";
import { computeWeeklyPlanGuardrails } from "../weeklyPlanGuardrails";
import { contexts } from "./fixtures";
import { buildSafeFallbackWeeklyPlan } from "../buildSafeFallbackWeeklyPlan";

describe("modifyWeeklyPlan follow-ups", () => {
  it("removes strength sessions", () => {
    const ctx = contexts.hybrid();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    const withStrength = {
      ...plan,
      workouts: [
        ...plan.workouts,
        {
          day: "Tue",
          modality: "strength" as const,
          type: "strength",
          title: "Gym",
          durationMin: 40,
          intensity: "moderate" as const,
          purpose: "Strength",
          constraintsApplied: [],
          reasoning: "Support",
        },
      ],
    };
    const out = applyPlanModification(withStrength, "remove_strength", g);
    expect(out.workouts.every((w) => w.modality !== "strength")).toBe(true);
  });

  it("reduces volume", () => {
    const ctx = contexts.noGoal();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    const before =
      plan.totalRunDistanceKm ?? plan.workouts.reduce((s, w) => s + (w.distanceKm ?? 0), 0);
    const out = applyPlanModification(plan, "reduce_volume", g);
    const after =
      out.totalRunDistanceKm ?? out.workouts.reduce((s, w) => s + (w.distanceKm ?? 0), 0);
    expect(after).toBeLessThan(before);
  });

  it("limits to available days", () => {
    const ctx = contexts.noGoal();
    const g = computeWeeklyPlanGuardrails(ctx);
    const plan = buildSafeFallbackWeeklyPlan(ctx, g);
    const out = applyPlanModification(plan, "limit_days", g, {
      availableDays: ["Mon", "Wed", "Fri"],
    });
    const days = out.workouts.filter((w) => w.modality !== "rest").map((w) => w.day.slice(0, 3));
    for (const d of days) {
      expect(["Mon", "Wed", "Fri"]).toContain(d);
    }
  });
});
