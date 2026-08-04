import { describe, expect, it } from "vitest";
import { assessFreshness } from "../freshnessModel";
import type { RaceForecastInput } from "../forecastTypes";

/**
 * P3 of docs/proposals/readiness-model.md.
 *
 * This model is a second, independent freshness assessment used by the race
 * forecast. It knew nothing about detraining, so a layoff's positive balance
 * read as taper sharpness: it sped the forecast up and never charged for lost
 * fitness. The shared readiness model now hands it a currency.
 */

function input(ctx: NonNullable<RaceForecastInput["athleteContext"]>): RaceForecastInput {
  return {
    recentBlocks: [],
    goal: { distance: "hm", raceDate: undefined, targetTimeSec: 7200 },
    athleteContext: ctx,
  } as unknown as RaceForecastInput;
}

describe("assessFreshness respects training currency", () => {
  it("does not read a layoff as sharpness", () => {
    // The live case: freshness capped at 65 by currency, balance still positive.
    const stale = assessFreshness(
      input({ freshnessScore: 65, tsb: 47, currency: "rusty", restDaysSinceLastRun: 10 }),
    );
    expect(stale.label).not.toBe("fresh");
    expect(stale.timeAdjustmentSec).toBeGreaterThan(0); // costs time, does not buy it
    expect(stale.evidence.join(" ")).toMatch(/not taper sharpness|decaying/i);
    expect(stale.currency).toBe("rusty");
  });

  it("charges more time the longer the athlete has been away", () => {
    const base = { freshnessScore: 60, tsb: 30 };
    const rusty = assessFreshness(input({ ...base, currency: "rusty", restDaysSinceLastRun: 10 }));
    const detrained = assessFreshness(
      input({ ...base, currency: "detrained", restDaysSinceLastRun: 20 }),
    );
    const returning = assessFreshness(
      input({ ...base, currency: "returning", restDaysSinceLastRun: 40 }),
    );
    expect(detrained.timeAdjustmentSec).toBeGreaterThan(rusty.timeAdjustmentSec);
    expect(returning.timeAdjustmentSec).toBeGreaterThan(detrained.timeAdjustmentSec);
  });

  it("flags a long layoff as making the target provisional", () => {
    const r = assessFreshness(
      input({ freshnessScore: 40, tsb: 20, currency: "returning", restDaysSinceLastRun: 45 }),
    );
    expect(r.risks.join(" ")).toMatch(/provisional/i);
  });

  it("still lets a genuinely sharp athlete read fresh", () => {
    // No regression: current training, high freshness, modest positive balance.
    const sharp = assessFreshness(
      input({
        freshnessScore: 82,
        tsb: 12,
        hardRunsLast14d: 2,
        currency: "current",
        restDaysSinceLastRun: 1,
      }),
    );
    expect(sharp.label).toBe("fresh");
    expect(sharp.timeAdjustmentSec).toBeLessThanOrEqual(0);
  });

  it("treats a light gap as still current", () => {
    const light = assessFreshness(
      input({ freshnessScore: 80, tsb: 15, currency: "light-gap", restDaysSinceLastRun: 5 }),
    );
    expect(light.timeAdjustmentSec).toBeLessThanOrEqual(0);
    expect(light.label).not.toBe("fatigued");
  });
});

describe("behaviour without a currency", () => {
  it("falls back to rest days for inputs built before currency existed", () => {
    const r = assessFreshness(input({ freshnessScore: 90, tsb: 50, restDaysSinceLastRun: 12 }));
    expect(r.label).not.toBe("fresh");
    expect(r.timeAdjustmentSec).toBeGreaterThan(0);
  });

  it("keeps the old TSB guess only when it cannot know better", () => {
    const guessed = assessFreshness(input({ freshnessScore: 70, tsb: 25 }));
    expect(guessed.risks.join(" ")).toMatch(/taper vs detraining/i);

    // With currency supplied, the guess is replaced by the real signal rather
    // than reported alongside it.
    const known = assessFreshness(
      input({ freshnessScore: 70, tsb: 25, currency: "current", restDaysSinceLastRun: 1 }),
    );
    expect(known.risks.join(" ")).not.toMatch(/taper vs detraining/i);
  });
});
