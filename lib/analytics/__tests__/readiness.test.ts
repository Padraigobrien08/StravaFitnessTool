import { describe, expect, it } from "vitest";
import {
  raceReadiness,
  halfMarathonReadiness,
  longRunPercentOfRace,
  formatLongRunVsRace,
  RACE_READINESS_CONFIG,
} from "../readiness";
import { buildRacePredictionAnalysis } from "../predictions";
import type { RunActivity } from "@/lib/strava/types";

function mockRun(id: string, date: string, km: number): RunActivity {
  const movingSec = Math.round(km * 1000 * 5);
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

describe("raceReadiness", () => {
  it("scores high for HM prep with long runs and volume", () => {
    const runs: RunActivity[] = [];
    for (let i = 0; i < 12; i++) {
      runs.push(
        mockRun(
          String(i),
          new Date(Date.now() - i * 2 * 86400000).toISOString().slice(0, 10),
          i === 0 ? 20 : 12,
        ),
      );
    }
    const analysis = buildRacePredictionAnalysis(runs, []);
    const future = new Date();
    future.setDate(future.getDate() + 21);
    const readiness = raceReadiness(
      runs,
      { distance: "hm", date: future.toISOString().slice(0, 10) },
      [],
      analysis,
    );
    expect(readiness.score).toBeGreaterThanOrEqual(80);
    expect(readiness.daysUntilRace).toBeGreaterThanOrEqual(20);
    expect(readiness.distanceLabel).toContain("Half");
  });

  it("long-run percent uses race distance not training benchmark", () => {
    const raceKm = RACE_READINESS_CONFIG.hm.raceDistanceKm;
    expect(longRunPercentOfRace(20.5, raceKm)).toBe(97);
    expect(formatLongRunVsRace(20.5, raceKm)).toBe("20.5 km (97% of 21.1 km race)");
  });

  it("halfMarathonReadiness matches legacy shape", () => {
    const runs = [mockRun("1", "2025-01-01", 21)];
    const hm = halfMarathonReadiness(runs);
    expect(hm.score).toBeGreaterThan(0);
    expect(hm.label).toBeTruthy();
  });
});
