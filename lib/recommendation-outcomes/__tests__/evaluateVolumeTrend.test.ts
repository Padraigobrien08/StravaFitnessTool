import { describe, expect, it } from "vitest";
import { evaluateVolumeTrendAdherence } from "../evaluateVolumeTrend";
import type { LoggedRecommendation } from "../types";
import type { RunActivity } from "@/lib/strava/types";

function rec(
  targetWeeklyKm: number | null,
  issuedAt = "2026-07-01T08:00:00.000Z",
): LoggedRecommendation {
  return {
    recommendationId: `goal_scenario:2026-06-29`,
    producer: "goal_scenario",
    issuedAt,
    targetDate: "2026-06-29",
    kind: "build_volume",
    headline: "Build volume toward the target",
    distanceKmMin: null,
    distanceKmMax: null,
    targetWeeklyKm,
  };
}

function run(id: string, date: string, distanceKm: number): RunActivity {
  return {
    id,
    date,
    name: id,
    distanceM: distanceKm * 1000,
    elapsedSec: 3000,
    movingSec: 3000,
    avgSpeedMps: 3.3,
    maxSpeedMps: 5,
    avgHr: 150,
    maxHr: 170,
    elevationGainM: 10,
    calories: 400,
    relativeEffort: 80,
    trainingLoad: 200,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: 80,
    totalSteps: null,
    weatherTempC: null,
  };
}

// ~3 weeks of runs at a chosen weekly volume, starting the day after issue.
function weeksOfRuns(weeklyKm: number, weeks: number): RunActivity[] {
  const runs: RunActivity[] = [];
  const perRun = weeklyKm / 4; // 4 runs/week
  for (let w = 0; w < weeks; w++) {
    for (let i = 0; i < 4; i++) {
      const day = 2 + w * 7 + i * 1; // July 2 onward
      runs.push(run(`w${w}r${i}`, `2026-07-${String(day).padStart(2, "0")}`, perRun));
    }
  }
  return runs;
}

describe("evaluateVolumeTrendAdherence", () => {
  it("is pending before enough time has elapsed", () => {
    const r = evaluateVolumeTrendAdherence(rec(50), weeksOfRuns(50, 1), "2026-07-05");
    expect(r.adherence).toBe("pending");
  });

  it("is followed when weekly volume tracks the target", () => {
    const r = evaluateVolumeTrendAdherence(rec(48), weeksOfRuns(48, 3), "2026-07-22");
    expect(r.adherence).toBe("followed");
    expect(r.note).toMatch(/target/);
  });

  it("is skipped when volume falls well short of target", () => {
    const r = evaluateVolumeTrendAdherence(rec(80), weeksOfRuns(30, 3), "2026-07-22");
    expect(r.adherence).toBe("skipped");
  });

  it("is partial when volume is building but short", () => {
    const r = evaluateVolumeTrendAdherence(rec(60), weeksOfRuns(45, 3), "2026-07-22");
    expect(r.adherence).toBe("partial");
  });

  it("is unknown without a volume target", () => {
    const r = evaluateVolumeTrendAdherence(rec(null), weeksOfRuns(50, 3), "2026-07-22");
    expect(r.adherence).toBe("unknown");
  });
});
