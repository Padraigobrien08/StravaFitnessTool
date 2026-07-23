import { describe, expect, it } from "vitest";
import { computeCorrelations, pearson } from "../correlations";
import type { RunActivity } from "@/lib/strava/types";

function mockRun(
  id: string,
  date: string,
  opts: { paceSec?: number; avgHr?: number; tempC?: number | null; cadence?: number | null } = {},
): RunActivity {
  const km = 10;
  const paceSec = opts.paceSec ?? 300;
  return {
    id,
    name: `Run ${id}`,
    date: `${date}T09:00:00.000Z`,
    distanceM: km * 1000,
    movingSec: Math.round(km * paceSec),
    elapsedSec: Math.round(km * paceSec),
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr: opts.avgHr ?? 150,
    maxHr: 165,
    elevationGainM: 20,
    calories: null,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: paceSec,
    avgCadence: opts.cadence === undefined ? 172 : opts.cadence,
    totalSteps: null,
    weatherTempC: opts.tempC === undefined ? 15 : opts.tempC,
  };
}

describe("pearson", () => {
  it("recovers ≈ +1 for a perfect positive relationship", () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])!).toBeCloseTo(1, 5);
  });
  it("recovers ≈ −1 for a perfect negative relationship", () => {
    expect(pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])!).toBeCloseTo(-1, 5);
  });
  it("is near zero for an unrelated pair", () => {
    expect(Math.abs(pearson([1, 2, 3, 4, 5, 6], [3, 1, 4, 1, 5, 2])!)).toBeLessThan(0.5);
  });
  it("returns null with no spread", () => {
    expect(pearson([5, 5, 5, 5], [1, 2, 3, 4])).toBeNull();
  });
});

describe("computeCorrelations", () => {
  it("recovers an engineered temperature↔pace association", () => {
    // 10 weekly runs where hotter days are linearly slower.
    const runs: RunActivity[] = [];
    for (let i = 0; i < 10; i++) {
      const day = String(1 + i).padStart(2, "0");
      const tempC = 8 + i * 2;
      runs.push(mockRun(`r${i}`, `2026-06-${day}`, { tempC, paceSec: 280 + tempC * 2 }));
    }
    const c = computeCorrelations(runs);
    expect(c.available).toBe(true);
    const tp = c.correlations.find((x) => x.key === "temp_pace")!;
    expect(tp).toBeTruthy();
    expect(tp.direction).toBe("positive");
    expect(tp.strength).toBe("strong");
    expect(tp.interpretation).toMatch(/hotter days tend to be slower/);
  });

  it("carries a caveat on every correlation and a standing causation limitation", () => {
    const runs: RunActivity[] = [];
    for (let i = 0; i < 10; i++) {
      const day = String(1 + i).padStart(2, "0");
      runs.push(mockRun(`r${i}`, `2026-06-${day}`, { tempC: 8 + i * 2, paceSec: 280 + i * 4 }));
    }
    const c = computeCorrelations(runs);
    expect(c.correlations.every((x) => x.caveat.length > 0)).toBe(true);
    expect(c.correlations.every((x) => /not causation/i.test(x.caveat))).toBe(true);
    expect(c.limitations.some((l) => /not causation/i.test(l))).toBe(true);
  });

  it("is unavailable when no pair reaches the minimum sample size", () => {
    const runs = [
      mockRun("a", "2026-06-01"),
      mockRun("b", "2026-06-08"),
      mockRun("c", "2026-06-15"),
    ];
    const c = computeCorrelations(runs);
    expect(c.available).toBe(false);
    expect(c.limitations.length).toBeGreaterThan(0);
  });
});
