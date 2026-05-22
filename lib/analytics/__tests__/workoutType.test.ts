import { describe, expect, it } from "vitest";
import { classifyRun, classifyAllRuns } from "../workoutType";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail, FitLap } from "@/lib/strava/fitTypes";

function mockRun(
  overrides: Partial<RunActivity> & { id: string; name: string; date: string }
): RunActivity {
  const movingSec = 3000;
  return {
    distanceM: 10000,
    movingSec,
    elapsedSec: movingSec,
    avgHr: 140,
    maxHr: 160,
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
    ...overrides,
  } as RunActivity;
}

describe("classifyRun", () => {
  it("classifies easy run with low HR", () => {
    const run = mockRun({
      id: "1",
      name: "Morning easy",
      date: "2025-05-01",
      distanceM: 10000,
      avgHr: 130,
    });
    const result = classifyRun(run, 190, undefined, false);
    expect(result.type).toBe("easy");
    expect(["medium", "high"]).toContain(result.confidence);
  });

  it("classifies interval from lap variability", () => {
    const run = mockRun({
      id: "2",
      name: "Track intervals",
      date: "2025-05-02",
      distanceM: 12000,
      avgHr: 170,
    });
    const laps: FitLap[] = [240, 300, 240, 310, 235, 305].map((pace, i) => ({
      index: i + 1,
      distanceM: 1000,
      timeSec: pace * 10,
      avgHr: 170,
      avgPaceSecPerKm: pace,
      avgCadence: null,
    }));
    const fit: FitRunDetail = {
      activityId: "2",
      laps,
      hrStream: [],
      paceStream: [],
      cadenceStream: [],
      hrDriftPct: null,
      avgCadence: null,
      bestEfforts: [],
    };
    const result = classifyRun(run, 190, fit, false);
    expect(result.type).toBe("interval");
    expect(result.confidence).toBe("high");
  });

  it("returns unknown without HR and generic name", () => {
    const run = mockRun({
      id: "3",
      name: "Run",
      date: "2025-05-03",
      avgHr: null,
      distanceM: 8000,
    });
    const result = classifyRun(run, 190, undefined, false);
    expect(result.type).toBe("unknown");
    expect(result.confidence).toBe("low");
  });
});

describe("classifyAllRuns", () => {
  it("labels each run", () => {
    const runs = [
      mockRun({ id: "a", name: "Easy", date: "2025-05-01", avgHr: 130 }),
      mockRun({ id: "b", name: "Tempo", date: "2025-05-03", avgHr: 165 }),
    ];
    const labels = classifyAllRuns(runs, [], 190);
    expect(labels).toHaveLength(2);
    expect(labels[0].classification.type).toBe("easy");
  });
});
