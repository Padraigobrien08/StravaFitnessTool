import { describe, expect, it } from "vitest";
import { buildWeeklyNarrative } from "../narrative";
import type { RunActivity } from "@/lib/strava/types";

function mockRun(id: string, date: string, km: number, hr = 150): RunActivity {
  const movingSec = Math.round(km * 1000 * 5);
  return {
    id,
    name: `Run ${id}`,
    date,
    distanceM: km * 1000,
    movingSec,
    elapsedSec: movingSec,
    avgHr: hr,
    maxHr: hr + 10,
    avgSpeedMps: null,
    maxSpeedMps: null,
    elevationGainM: 50,
    calories: null,
    relativeEffort: null,
    trainingLoad: 50,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  } as RunActivity;
}

describe("buildWeeklyNarrative", () => {
  it("mentions run count and volume in bullets", () => {
    const runs = [
      mockRun("1", "2025-05-12", 10),
      mockRun("2", "2025-05-13", 8),
      mockRun("3", "2025-05-14", 7.5),
    ];
    const narrative = buildWeeklyNarrative(
      runs,
      {
        athleteMaxHr: 190,
        dataConfidence: "high",
        goalProgress: {
          goalLabel: "3 runs / week",
          targetPerWeek: 3,
          currentWeekRuns: 3,
          met: true,
          weeksMet: 5,
          weeksTotal: 8,
          weeklyBreakdown: [],
        },
        efficiencySummary: { latest: 0.03, trend: null },
      },
      0
    );
    expect(narrative.paragraphs.length).toBeGreaterThan(0);
    expect(narrative.bullets.some((b) => b.includes("runs"))).toBe(true);
  });
});
