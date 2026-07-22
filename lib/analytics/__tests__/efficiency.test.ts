import { describe, expect, it } from "vitest";
import { aerobicEfficiencyTrend, efficiencyMonthOverMonth } from "../efficiency";
import type { RunActivity } from "@/lib/strava/types";

function mockRun(date: string, paceMin: number): RunActivity {
  const paceSec = paceMin * 60;
  const movingSec = Math.round(5 * 1000 * (paceSec / 1000));
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
    trainingLoad: 50,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  } as RunActivity;
}

describe("efficiencyMonthOverMonth", () => {
  it("produces narrative with two months of data", () => {
    const runs = [
      ...Array.from({ length: 3 }, (_, i) => mockRun(`2025-01-${10 + i}`, 5.5)),
      ...Array.from({ length: 3 }, (_, i) => mockRun(`2025-02-${10 + i}`, 5.0)),
    ];
    const points = aerobicEfficiencyTrend(runs);
    const mom = efficiencyMonthOverMonth(points);
    expect(mom.currentMonth).toBe("2025-02");
    expect(mom.priorMonth).toBe("2025-01");
  });
});
