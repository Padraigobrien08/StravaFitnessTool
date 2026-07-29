import { describe, it, expect } from "vitest";
import { buildSafeFallbackWeeklyPlan } from "../buildSafeFallbackWeeklyPlan";
import { computeWeeklyPlanGuardrails } from "../weeklyPlanGuardrails";
import { contexts } from "./fixtures";

/**
 * Two things the athlete sees directly, both previously wrong on a reduced week:
 * a distance rendered as 5.73999999999999 km, and a 5.7 km session titled
 * "Long run · Weekly endurance anchor".
 */

const ALL_CONTEXTS = [
  ["noGoal", contexts.noGoal],
  ["raceWeek", contexts.raceWeek],
  ["taper", contexts.taper],
  ["fatigueHeavy", contexts.fatigueHeavy],
  ["hybrid", contexts.hybrid],
  ["lowData", contexts.lowData],
  ["overloaded", contexts.overloaded],
] as const;

describe("fallback plan distances", () => {
  for (const [name, make] of ALL_CONTEXTS) {
    it(`${name}: every planned distance is clean to one decimal`, () => {
      const ctx = make();
      const plan = buildSafeFallbackWeeklyPlan(ctx, computeWeeklyPlanGuardrails(ctx));
      for (const w of plan.workouts) {
        if (w.distanceKm == null) continue;
        // No floating-point tails: 5.7 is fine, 5.73999999999999 is not.
        expect(w.distanceKm, `${name} / ${w.day} ${w.title}`).toBe(
          Math.round(w.distanceKm * 10) / 10,
        );
        expect(String(w.distanceKm), `${name} / ${w.day}`).not.toMatch(/\.\d{2,}/);
      }
    });
  }
});

describe("fallback long-run labelling", () => {
  for (const [name, make] of ALL_CONTEXTS) {
    it(`${name}: nothing is called a long run unless it is one`, () => {
      const ctx = make();
      const plan = buildSafeFallbackWeeklyPlan(ctx, computeWeeklyPlanGuardrails(ctx));
      for (const w of plan.workouts) {
        if (!/long run/i.test(w.title)) continue;
        // A "long run" with a distance must be a plausible endurance session.
        if (w.distanceKm != null) {
          expect(
            w.distanceKm,
            `${name}: "${w.title}" at ${w.distanceKm} km`,
          ).toBeGreaterThanOrEqual(8);
        }
      }
    });
  }

  it("renames the longest run when a capped week makes it short", () => {
    // fatigueHeavy caps volume hard, which is the case that produced a 5.7 km
    // session presented as the weekly endurance anchor.
    const ctx = contexts.fatigueHeavy();
    const plan = buildSafeFallbackWeeklyPlan(ctx, computeWeeklyPlanGuardrails(ctx));
    const short = plan.workouts.filter((w) => w.distanceKm != null && w.distanceKm < 8);
    for (const w of short) {
      expect(w.title).not.toMatch(/^long run$/i);
      expect(w.purpose).not.toMatch(/weekly endurance anchor/i);
    }
  });
});
