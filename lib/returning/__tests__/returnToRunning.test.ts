import { describe, expect, it } from "vitest";
import {
  buildReturnToRunning,
  buildTargetOptions,
  estimateRetention,
  preGapBaseline,
  restartWeeklyKm,
  weeksToReach,
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

describe("weeksToReach", () => {
  it("takes longer to rebuild after a longer layoff", () => {
    const from = (gapDays: number) => weeksToReach(restartWeeklyKm(40, gapDays), 40);
    expect(from(60)).toBeGreaterThan(from(10));
    expect(from(10)).toBeGreaterThanOrEqual(1);
  });

  // Week 1 is the restart, so week N carries 1.1^(N-1). Asserting only that the
  // number grows with the gap let an off-by-one through: it claimed 4 weeks while
  // week 4 was still short of the baseline.
  it("names a week that has actually reached the target", () => {
    for (const gapDays of [10, 20, 40, 90]) {
      const start = restartWeeklyKm(40, gapDays);
      const n = weeksToReach(start, 40);
      expect(start * Math.pow(1.1, n - 1), `gap ${gapDays}d, week ${n}`).toBeGreaterThanOrEqual(40);
      // ...and it should not overshoot by a whole week.
      expect(start * Math.pow(1.1, n - 2), `gap ${gapDays}d, week ${n - 1}`).toBeLessThan(40);
    }
  });

  it("takes longer to reach a bigger target from the same restart", () => {
    const start = restartWeeklyKm(40, 20);
    expect(weeksToReach(start, 80)).toBeGreaterThan(weeksToReach(start, 40));
  });

  it("is one week when the target is already met", () => {
    expect(weeksToReach(40, 40)).toBe(1);
    expect(weeksToReach(40, 10)).toBe(1);
  });
});

describe("the baseline counts weeks you did not run", () => {
  // Building the histogram only from weeks containing runs made this "the
  // median of the weeks you ran". With a 4-week window the two answers only
  // diverge once two weeks are empty, which is why no real gap on file changed
  // — and why this needs a test rather than a screenshot.
  it("treats an empty week as zero, not as absent", () => {
    const gapStart = subDays(new Date(), 1);
    // A 4-week window with running in only the last two: weekly totals are
    // [0, 0, 10, 30]. Counting the empty weeks gives a median of 10; omitting
    // them takes the median of [10, 30] and reports 30 — triple the truth.
    const runs = [run(11, 10), run(6, 10), run(5, 10), run(4, 10)];
    const base = preGapBaseline(runs, gapStart)!;
    expect(base.weeklyKm).toBe(10);
    expect(base.weeksSampled).toBe(4);
  });

  it("reports null rather than zero when most of the window is empty", () => {
    // Three runs all in the oldest week: the median of [30, 0, 0, 0] is 0,
    // which is not a baseline anyone can ramp from.
    const gapStart = subDays(new Date(), 1);
    const runs = [run(27, 10), run(26, 10), run(25, 10)];
    expect(preGapBaseline(runs, gapStart)).toBeNull();
  });
});

describe("choosing where the ramp ends", () => {
  const bestBlock = { label: "Apr 3 – May 1", distanceKm: 138.2 };

  it("offers the best block only when it is materially bigger", () => {
    const small = buildTargetOptions(
      { weeklyKm: 30, longestRunKm: 15, weeksSampled: 4 },
      {
        label: "x",
        distanceKm: 124, // 31 km/wk — barely different, not worth asking about
      },
    );
    expect(small.map((o) => o.source)).toEqual(["pre-gap"]);

    const big = buildTargetOptions(
      { weeklyKm: 11.1, longestRunKm: 11, weeksSampled: 4 },
      bestBlock,
    );
    expect(big.map((o) => o.source)).toEqual(["pre-gap", "best-block"]);
    expect(big[1].weeklyKm).toBeCloseTo(34.6, 1);
  });

  it("defaults to the pre-gap weeks when nothing is chosen", () => {
    const plan = buildReturnToRunning(blockThenGap(20), fatigue("detrained", 20), new Date(), {
      bestBlock,
    })!;
    expect(plan.target?.source).toBe("pre-gap");
    expect(plan.target?.weeklyKm).toBe(plan.baseline?.weeklyKm);
  });

  // A bigger target does not mean a faster ramp. The 10%/week rate is fixed by
  // tissue tolerance, so the target only decides when the climb stops — which
  // is why the first four weeks are identical and only the timeline moves.
  it("does not steepen the ramp when the target is raised", () => {
    const runs = blockThenGap(20);
    const base = buildReturnToRunning(runs, fatigue("detrained", 20))!;
    const ambitious = buildReturnToRunning(runs, fatigue("detrained", 20), new Date(), {
      targetKm: 70,
    })!;
    expect(ambitious.weeks.map((w) => w.targetKm)).toEqual(base.weeks.map((w) => w.targetKm));
    expect(ambitious.weeksToTarget).toBeGreaterThan(base.weeksToTarget);
  });

  it("caps the ramp earlier when the target is lowered", () => {
    const runs = blockThenGap(20);
    const base = buildReturnToRunning(runs, fatigue("detrained", 20))!;
    const modest = buildReturnToRunning(runs, fatigue("detrained", 20), new Date(), {
      targetKm: 19,
    })!;
    expect(modest.weeks[0].targetKm).toBe(base.weeks[0].targetKm);
    expect(modest.weeks[3].targetKm).toBeLessThan(base.weeks[3].targetKm);
    expect(modest.weeks[3].targetKm).toBeLessThanOrEqual(19);
  });

  it("accepts a target that matches no option as a custom one", () => {
    const plan = buildReturnToRunning(blockThenGap(20), fatigue("detrained", 20), new Date(), {
      bestBlock,
      targetKm: 25,
    })!;
    expect(plan.target).toMatchObject({ source: "custom", weeklyKm: 25 });
  });

  it("never lets the ramp exceed the chosen target", () => {
    for (const targetKm of [5, 20, 34.6, 100]) {
      const plan = buildReturnToRunning(blockThenGap(20), fatigue("detrained", 20), new Date(), {
        targetKm,
      })!;
      for (const w of plan.weeks)
        expect(w.targetKm, `target ${targetKm}`).toBeLessThanOrEqual(targetKm);
    }
  });
});
