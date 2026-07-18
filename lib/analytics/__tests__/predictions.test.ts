import { describe, expect, it } from "vitest";
import {
  buildRacePredictionAnalysis,
  collectEffortPoints,
  fitPowerLawRegression,
  predictCameron,
} from "../predictions";
import { predictRaceTime } from "../records";
import type { RunActivity } from "@/lib/strava/types";

function mockRun(
  id: string,
  km: number,
  paceMin: number,
  date = "2025-01-15"
): RunActivity {
  const paceSec = paceMin * 60;
  const movingSec = Math.round(km * 1000 * (paceSec / 1000));
  return {
    id,
    name: `Run ${id}`,
    date,
    distanceM: km * 1000,
    movingSec,
    elapsedSec: movingSec,
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr: 155,
    maxHr: 175,
    elevationGainM: 50,
    calories: null,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  };
}

describe("buildRacePredictionAnalysis", () => {
  it("returns empty when no data", () => {
    const analysis = buildRacePredictionAnalysis([], []);
    expect(analysis.models.length).toBe(0);
    expect(analysis.consensus.length).toBe(0);
  });

  it("builds models and consensus from quality runs", () => {
    const runs = [
      mockRun("1", 5, 4.5),
      mockRun("2", 10, 4.8),
      mockRun("3", 8, 4.6),
      mockRun("4", 12, 5.0),
    ];
    const analysis = buildRacePredictionAnalysis(runs, []);
    expect(analysis.efforts.length).toBeGreaterThanOrEqual(4);
    expect(analysis.models.some((m) => m.id === "riegel")).toBe(true);
    expect(analysis.models.some((m) => m.id === "cameron")).toBe(true);
    expect(analysis.consensus.length).toBe(4);
    expect(analysis.explanation.length).toBeGreaterThan(2);
    expect(analysis.primaryAnchor).not.toBeNull();
  });
});

describe("fitPowerLawRegression", () => {
  it("fits when enough efforts exist", () => {
    const runs = [mockRun("1", 5, 4.5), mockRun("2", 10, 4.8), mockRun("3", 8, 4.6)];
    const efforts = collectEffortPoints(runs, [], []);
    const fit = fitPowerLawRegression(efforts);
    expect(fit).not.toBeNull();
    expect(fit!.exponent).toBeGreaterThan(1);
    expect(fit!.curve.length).toBeGreaterThan(10);
  });
});

describe("predictCameron", () => {
  it("predicts longer time than riegel for marathon from 10k", () => {
    const t10 = 3000;
    const d10 = 10000;
    const d42 = 42195;
    const riegel = predictRaceTime(d10, t10, d42);
    const cameron = predictCameron(d10, t10, d42);
    expect(cameron).toBeGreaterThan(riegel);
  });
});
