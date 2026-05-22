import { describe, expect, it } from "vitest";
import { buildConsistencyScore, weeklyRunStreak } from "../consistency";
import type { RunActivity } from "@/lib/strava/types";
import { startOfWeek, format, subWeeks } from "date-fns";

function mockRun(date: string): RunActivity {
  const movingSec = 3000;
  return {
    id: date,
    name: "Run",
    date,
    distanceM: 5000,
    movingSec,
    elapsedSec: movingSec,
    avgHr: 150,
    maxHr: 170,
    avgSpeedMps: null,
    maxSpeedMps: null,
    elevationGainM: 50,
    calories: null,
    relativeEffort: null,
    trainingLoad: 40,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  } as RunActivity;
}

describe("buildConsistencyScore", () => {
  it("scores high with steady weekly runs", () => {
    const runs: RunActivity[] = [];
    for (let i = 0; i < 8; i++) {
      const d = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
      runs.push(mockRun(format(d, "yyyy-MM-dd")));
    }
    const score = buildConsistencyScore(runs, null, 1);
    expect(score.overall).toBeGreaterThanOrEqual(75);
    expect(weeklyRunStreak(runs)).toBeGreaterThanOrEqual(1);
  });
});
