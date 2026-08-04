import { describe, expect, it } from "vitest";
import {
  buildReturnToRunning,
  estimateRetention,
  preGapBaseline,
  weeksToBaseline,
} from "../returnToRunning";
import type { RunActivity } from "@/lib/strava/types";
import type { FatigueSnapshot } from "@/lib/analytics/fatigue";
import { format, subDays } from "date-fns";

function run(daysAgo: number, km: number): RunActivity {
  return {
    id: `${daysAgo}-${km}`,
    name: "Run",
    date: format(subDays(new Date(), daysAgo), "yyyy-MM-dd"),
    distanceM: km * 1000,
    movingSec: km * 300,
    elapsedSec: km * 300,
    avgHr: 145,
    maxHr: 165,
    avgSpeedMps: null,
    maxSpeedMps: null,
    elevationGainM: 0,
    calories: null,
    relativeEffort: null,
    trainingLoad: km * 10,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  } as RunActivity;
}

const fatigue = (
  currency: FatigueSnapshot["readiness"]["currency"],
  restDays: number,
): Pick<FatigueSnapshot, "readiness" | "restDaysSinceLastRun"> => ({
  readiness: { balance: "fresh", currency, volumeRatio: null },
  restDaysSinceLastRun: restDays,
});

/** Four weeks at roughly 40 km, then a gap of `gapDays`. */
function blockThenGap(gapDays: number): RunActivity[] {
  const runs: RunActivity[] = [];
  for (let d = gapDays + 28; d > gapDays; d -= 2) runs.push(run(d, 10));
  return runs;
}

describe("buildReturnToRunning gating", () => {
  it("returns nothing while training is current", () => {
    expect(buildReturnToRunning(blockThenGap(1), fatigue("current", 1))).toBeNull();
    expect(buildReturnToRunning(blockThenGap(5), fatigue("light-gap", 5))).toBeNull();
  });

  it("produces a plan once the athlete has been away", () => {
    for (const [currency, days] of [
      ["rusty", 10],
      ["detrained", 20],
      ["returning", 40],
    ] as const) {
      expect(buildReturnToRunning(blockThenGap(days), fatigue(currency, days))).not.toBeNull();
    }
  });
});

describe("the ramp is conservative and grounded in the athlete's own baseline", () => {
  it("restarts below the pre-gap week and never exceeds it", () => {
    const runs = blockThenGap(20);
    const plan = buildReturnToRunning(runs, fatigue("detrained", 20))!;
    expect(plan.baseline).not.toBeNull();
    const base = plan.baseline!.weeklyKm;
    expect(plan.weeks[0].targetKm).toBeLessThan(base);
    for (const w of plan.weeks) expect(w.targetKm).toBeLessThanOrEqual(base);
  });

  it("starts lower the longer the athlete was away", () => {
    const short = buildReturnToRunning(blockThenGap(10), fatigue("rusty", 10))!;
    const long = buildReturnToRunning(blockThenGap(60), fatigue("returning", 60))!;
    const shortFrac = short.weeks[0].targetKm / short.baseline!.weeklyKm;
    const longFrac = long.weeks[0].targetKm / long.baseline!.weeklyKm;
    expect(longFrac).toBeLessThan(shortFrac);
  });

  it("increases volume week on week", () => {
    const plan = buildReturnToRunning(blockThenGap(20), fatigue("detrained", 20))!;
    for (let i = 1; i < plan.weeks.length; i++) {
      expect(plan.weeks[i].targetKm).toBeGreaterThanOrEqual(plan.weeks[i - 1].targetKm);
    }
  });

  it("withholds quality work until easy running has been re-established", () => {
    // The guarantee: week 1 back is never a quality week, however long the gap.
    for (const days of [10, 20, 40, 90]) {
      const plan = buildReturnToRunning(blockThenGap(days), fatigue("returning", days))!;
      expect(plan.weeks[0].quality).toBe(false);
    }
    // And a longer layoff waits longer than a short one.
    const short = buildReturnToRunning(blockThenGap(10), fatigue("rusty", 10))!;
    const long = buildReturnToRunning(blockThenGap(60), fatigue("returning", 60))!;
    const firstQuality = (p: typeof short) => p.weeks.findIndex((w) => w.quality);
    expect(firstQuality(long)).toBeGreaterThan(firstQuality(short));
  });

  it("keeps the long run a fraction of the week", () => {
    const plan = buildReturnToRunning(blockThenGap(30), fatigue("returning", 30))!;
    for (const w of plan.weeks) {
      expect(w.longestRunKm).toBeLessThanOrEqual(w.targetKm * 0.4 + 0.05);
      expect(w.longestRunKm).toBeLessThanOrEqual(plan.baseline!.longestRunKm);
    }
  });
});

describe("retention estimate", () => {
  it("costs sharpness before endurance", () => {
    const r = estimateRetention(21);
    expect(r.sharpnessPct).toBeLessThan(r.aerobicPct);
  });

  it("charges nothing for the first week off", () => {
    expect(estimateRetention(7).aerobicPct).toBe(100);
    expect(estimateRetention(7).sharpnessPct).toBe(100);
  });

  it("decays with time away but never to zero", () => {
    const long = estimateRetention(365);
    expect(long.aerobicPct).toBeGreaterThanOrEqual(55);
    expect(long.sharpnessPct).toBeGreaterThanOrEqual(30);
    expect(long.aerobicPct).toBeLessThan(estimateRetention(30).aerobicPct);
  });
});

describe("baseline measurement", () => {
  it("is null without enough pre-gap running to measure", () => {
    expect(preGapBaseline([run(40, 8)], subDays(new Date(), 30))).toBeNull();
  });

  it("degrades to advice when no baseline exists", () => {
    const plan = buildReturnToRunning([run(40, 8)], fatigue("returning", 40))!;
    expect(plan.baseline).toBeNull();
    expect(plan.weeks).toHaveLength(0);
    expect(plan.firstStep).toMatch(/short easy runs/i);
  });

  it("ignores runs inside the gap when measuring the baseline", () => {
    const gapStart = subDays(new Date(), 20);
    const base = preGapBaseline([...blockThenGap(20), run(5, 42)], gapStart);
    // The 42 km run is after the gap started, so it must not become the longest.
    expect(base!.longestRunKm).toBeLessThan(42);
  });
});

describe("weeksToBaseline", () => {
  it("takes longer to rebuild after a longer layoff", () => {
    expect(weeksToBaseline(60)).toBeGreaterThan(weeksToBaseline(10));
    expect(weeksToBaseline(10)).toBeGreaterThanOrEqual(1);
  });

  // Week 1 is the restart, so week N carries 1.1^(N-1). Asserting only that the
  // number grows with the gap let an off-by-one through: it claimed 4 weeks while
  // week 4 was still short of the baseline.
  it("names a week that has actually reached the baseline", () => {
    for (const gapDays of [10, 20, 40, 90]) {
      const n = weeksToBaseline(gapDays);
      const f = restartFraction(gapDays);
      const atN = f * Math.pow(1.1, n - 1);
      expect(atN, `gap ${gapDays}d, week ${n}`).toBeGreaterThanOrEqual(1);
      // ...and it should not overshoot by a whole week.
      const atPrev = f * Math.pow(1.1, n - 2);
      expect(atPrev, `gap ${gapDays}d, week ${n - 1}`).toBeLessThan(1);
    }
  });
});

/** Mirrors the module's private restart fractions, for the arrival check above. */
function restartFraction(gapDays: number): number {
  if (gapDays <= 14) return 0.7;
  if (gapDays <= 28) return 0.5;
  if (gapDays <= 56) return 0.4;
  return 0.3;
}
