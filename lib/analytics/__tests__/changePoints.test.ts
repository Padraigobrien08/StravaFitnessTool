import { describe, expect, it } from "vitest";
import {
  computeFitnessChangePoints,
  detectChangePoints,
  type ChangePointSeriesPoint,
} from "../changePoints";
import type { FitnessIndexPoint } from "../trainingLoad";

function series(values: number[]): ChangePointSeriesPoint[] {
  return values.map((value, i) => ({ weekStart: `2026-W${i}`, label: `W${i}`, value }));
}

function fitness(values: number[]): FitnessIndexPoint[] {
  return values.map((ctl, i) => ({ weekStart: `2026-W${i}`, label: `W${i}`, ctl }));
}

describe("detectChangePoints", () => {
  it("finds a downward reversal at the peak of a rise-then-fall series", () => {
    const cps = detectChangePoints(series([10, 20, 30, 40, 50, 40, 30, 20, 10]));
    expect(cps.length).toBe(1);
    expect(cps[0].kind).toBe("reversal_down");
    expect(cps[0].label).toBe("W4"); // the peak
    expect(cps[0].deltaPerWeek).toBeLessThan(0);
  });

  it("finds an upward reversal at the trough of a fall-then-rise series", () => {
    const cps = detectChangePoints(series([50, 40, 30, 20, 10, 20, 30, 40, 50]));
    expect(cps.length).toBe(1);
    expect(cps[0].kind).toBe("reversal_up");
    expect(cps[0].deltaPerWeek).toBeGreaterThan(0);
  });

  it("finds no change-point in a steadily rising series", () => {
    const cps = detectChangePoints(series([10, 20, 30, 40, 50, 60, 70, 80, 90]));
    expect(cps.length).toBe(0);
  });

  it("suppresses near-adjacent points (NMS keeps them separated)", () => {
    const cps = detectChangePoints(series([10, 25, 45, 70, 100, 70, 45, 25, 10]), {
      minSeparation: 3,
    });
    for (let i = 1; i < cps.length; i++) {
      const wa = Number(cps[i - 1].label.slice(1));
      const wb = Number(cps[i].label.slice(1));
      expect(Math.abs(wb - wa)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("computeFitnessChangePoints", () => {
  it("is unavailable with fewer than eight weeks", () => {
    const r = computeFitnessChangePoints(fitness([10, 20, 30, 40, 50, 60]));
    expect(r.available).toBe(false);
  });

  it("detects a fitness peak-and-decline over enough history", () => {
    const r = computeFitnessChangePoints(fitness([20, 30, 40, 50, 60, 50, 40, 30, 20]));
    expect(r.available).toBe(true);
    expect(r.metricLabel).toBe("Fitness (CTL)");
    expect(r.changePoints.some((c) => c.kind === "reversal_down")).toBe(true);
    expect(r.changePoints[0].interpretation.length).toBeGreaterThan(0);
  });
});
