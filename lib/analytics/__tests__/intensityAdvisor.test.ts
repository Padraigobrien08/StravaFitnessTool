import { describe, expect, it } from "vitest";
import { buildIntensityAdvice } from "../intensityAdvisor";
import type { RunActivity } from "@/lib/strava/types";

function mockRun(hr: number): RunActivity {
  const movingSec = 3000;
  return {
    id: String(hr),
    name: "Run",
    date: new Date().toISOString().slice(0, 10),
    distanceM: 8000,
    movingSec,
    elapsedSec: movingSec,
    avgHr: hr,
    maxHr: hr + 5,
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

describe("buildIntensityAdvice", () => {
  it("flags too_hard when mostly hard runs", () => {
    const maxHr = 190;
    const runs = [
      mockRun(170),
      mockRun(175),
      mockRun(168),
      mockRun(172),
    ];
    const advice = buildIntensityAdvice(
      runs,
      maxHr,
      { easy: 1, hard: 9, easyPct: 10 }
    );
    expect(advice.status).toBe("too_hard");
    expect(advice.recommendations.length).toBeGreaterThanOrEqual(2);
  });
});
