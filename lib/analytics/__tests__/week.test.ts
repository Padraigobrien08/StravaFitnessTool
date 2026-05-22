import { describe, expect, it } from "vitest";
import {
  buildWeekSnapshot,
  compareWeeks,
  getWeekStart,
  buildCurrentAndPreviousWeek,
} from "../week";
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

describe("week snapshots", () => {
  it("builds snapshot for runs in ISO week", () => {
    const runs = [
      mockRun("1", "2025-05-12", 10),
      mockRun("2", "2025-05-14", 8),
    ];
    const ws = getWeekStart(new Date("2025-05-15"));
    const snap = buildWeekSnapshot(runs, ws, 190);
    expect(snap.runCount).toBe(2);
    expect(snap.distanceKm).toBe(18);
    expect(snap.longestRunKm).toBe(10);
  });

  it("compares volume between weeks", () => {
    const current = {
      weekStart: "2025-05-12",
      weekLabel: "May 12 – May 18",
      runCount: 3,
      distanceKm: 25.5,
      longestRunKm: 12,
      easyCount: 1,
      hardCount: 2,
      avgPaceSecPerKm: 300,
    };
    const previous = { ...current, distanceKm: 36.4, runCount: 4 };
    const cmp = compareWeeks(current, previous);
    expect(cmp.distanceKmDelta).toBeCloseTo(-10.9, 0);
    expect(cmp.distancePctChange).toBeLessThan(0);
  });

  it("returns current and previous week pair", () => {
    const runs = [mockRun("1", new Date().toISOString().slice(0, 10), 5)];
    const pair = buildCurrentAndPreviousWeek(runs, 190);
    expect(pair.current.runCount).toBeGreaterThanOrEqual(0);
    expect(pair.previous).not.toBeNull();
  });
});
