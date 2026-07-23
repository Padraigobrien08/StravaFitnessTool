import { describe, expect, it } from "vitest";
import { computeProgressionBurndown, type ProgressionBurndownInputs } from "../burndown";
import type { RaceGoal, RaceReadiness } from "../readiness";

const goal: RaceGoal = { distance: "marathon", date: "2025-12-01" };

/** Marathon readiness with 12 weeks to race → 9-week build deadline (−3wk taper). */
function readiness(longestRunKm: number, fourWeekVolumeKm = 160): RaceReadiness {
  return {
    distance: "marathon",
    daysUntilRace: 84,
    raceDate: "2025-12-01",
    longestRunKm,
    fourWeekVolumeKm,
  } as unknown as RaceReadiness;
}

function inputs(over: Partial<ProgressionBurndownInputs> = {}): ProgressionBurndownInputs {
  return {
    raceReadiness: readiness(20),
    recentLongRunsKm: [18, 19, 20],
    weeklyVolumeKm: [38, 39, 40],
    ...over,
  };
}

describe("computeProgressionBurndown", () => {
  it("is unavailable without a race goal", () => {
    const b = computeProgressionBurndown(inputs(), null);
    expect(b.available).toBe(false);
    expect(b.limitations.length).toBeGreaterThan(0);
  });

  it("is unavailable without readiness", () => {
    const b = computeProgressionBurndown(inputs({ raceReadiness: null }), goal);
    expect(b.available).toBe(false);
  });

  it("marks a metric met when current ≥ target", () => {
    const b = computeProgressionBurndown(
      inputs({ raceReadiness: readiness(34), recentLongRunsKm: [30, 32, 34] }),
      goal,
    );
    const longRun = b.metrics.find((m) => m.key === "long_run")!;
    expect(longRun.status).toBe("met");
    expect(longRun.weeksBehind).toBe(0);
  });

  it("flags behind when the recent ramp is too slow to reach the target in time", () => {
    // 20 → 32 km over 9 weeks needs ~1.3/wk; rising ~1/wk → arrives late.
    const b = computeProgressionBurndown(
      inputs({ raceReadiness: readiness(20), recentLongRunsKm: [18, 19, 20] }),
      goal,
    );
    const longRun = b.metrics.find((m) => m.key === "long_run")!;
    expect(longRun.status).toBe("behind");
    expect(longRun.weeksBehind!).toBeGreaterThan(0);
  });

  it("flags ahead when ramping faster than needed", () => {
    const b = computeProgressionBurndown(
      inputs({ raceReadiness: readiness(22), recentLongRunsKm: [14, 18, 22] }),
      goal,
    );
    const longRun = b.metrics.find((m) => m.key === "long_run")!;
    expect(longRun.status).toBe("ahead");
    expect(longRun.weeksBehind!).toBeLessThan(0);
  });

  it("flags stalled when the metric isn't trending up", () => {
    const b = computeProgressionBurndown(
      inputs({ raceReadiness: readiness(20), recentLongRunsKm: [20, 20, 20] }),
      goal,
    );
    const longRun = b.metrics.find((m) => m.key === "long_run")!;
    expect(longRun.status).toBe("stalled");
    expect(longRun.weeksBehind).toBeNull();
  });

  it("builds a target line ramping from current to target", () => {
    const b = computeProgressionBurndown(inputs({ raceReadiness: readiness(20) }), goal);
    const longRun = b.metrics.find((m) => m.key === "long_run")!;
    expect(longRun.targetLine.length).toBeGreaterThan(1);
    expect(longRun.targetLine[0].targetKm).toBeCloseTo(20, 0);
    expect(longRun.targetLine.at(-1)!.targetKm).toBeCloseTo(32, 0);
  });
});
