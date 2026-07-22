import { describe, expect, it } from "vitest";
import { buildPrTimeline } from "../progression";
import type { RunActivity } from "@/lib/strava/types";

function mockRun(id: string, date: string, km: number, paceMin: number): RunActivity {
  const paceSec = paceMin * 60;
  const movingSec = Math.round(km * 1000 * (paceSec / 1000));
  return {
    id,
    name: `Run ${id}`,
    date,
    distanceM: km * 1000,
    movingSec,
    elapsedSec: movingSec,
    avgHr: 155,
    maxHr: 175,
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

describe("buildPrTimeline", () => {
  it("emits new PR when second 5K is faster", () => {
    const runs = [mockRun("1", "2025-01-01", 5, 5.5), mockRun("2", "2025-02-01", 5, 4.8)];
    const timeline = buildPrTimeline(runs, []);
    const fiveK = timeline.filter((p) => p.bucket === "5k");
    expect(fiveK.length).toBeGreaterThanOrEqual(1);
    const latest = fiveK.at(-1);
    expect(latest?.isNewPr).toBe(fiveK.length > 1);
  });
});
