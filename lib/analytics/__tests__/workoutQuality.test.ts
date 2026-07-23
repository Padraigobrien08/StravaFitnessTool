import { describe, expect, it } from "vitest";
import { computeWorkoutQuality } from "../workoutQuality";
import type { WorkoutClassification, WorkoutType } from "../workoutType";
import type { FitLap, FitRunDetail } from "@/lib/strava/fitTypes";
import type { RunActivity } from "@/lib/strava/types";

function run(): RunActivity {
  return {
    id: "r1",
    date: "2026-07-01",
    name: "Session",
    distanceM: 10000,
    elapsedSec: 3000,
    movingSec: 3000,
    avgSpeedMps: 3.3,
    maxSpeedMps: 5,
    avgHr: 160,
    maxHr: 180,
    elevationGainM: 20,
    calories: 500,
    relativeEffort: 100,
    trainingLoad: 300,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: 80,
    totalSteps: null,
    weatherTempC: null,
  };
}

function cls(type: WorkoutType): WorkoutClassification {
  return { type, confidence: "high", signals: [] };
}

function lap(index: number, paceSecPerKm: number | null, avgHr: number | null = 165): FitLap {
  return {
    index,
    distanceM: 1000,
    timeSec: paceSecPerKm,
    avgHr,
    avgPaceSecPerKm: paceSecPerKm,
    avgCadence: 82,
  };
}

function fitWith(overrides: Partial<FitRunDetail>): FitRunDetail {
  return {
    activityId: "r1",
    bestEfforts: [],
    laps: [],
    hrStream: [],
    paceStream: [],
    cadenceStream: [],
    gpsStream: [],
    hrDriftPct: null,
    avgCadence: null,
    ...overrides,
  };
}

function stream(len: number, valueAt: (i: number) => number, key: "paceSecPerKm" | "hr") {
  return Array.from({ length: len }, (_, i) => ({
    elapsedSec: i * 30,
    [key]: valueAt(i),
  })) as never;
}

describe("computeWorkoutQuality — repeatability", () => {
  it("scores tight interval reps highly (low CV)", () => {
    // 5 work reps at ~200s/km with recovery jogs at 360s/km interleaved.
    const laps = [
      lap(1, 200),
      lap(2, 360),
      lap(3, 201),
      lap(4, 360),
      lap(5, 199),
      lap(6, 360),
      lap(7, 202),
      lap(8, 360),
      lap(9, 200),
    ];
    const q = computeWorkoutQuality(run(), fitWith({ laps }), cls("interval"));
    expect(q.applicable).toBe(true);
    expect(q.reps.length).toBe(5); // only the fast work reps
    expect(q.repeatabilityScore).not.toBeNull();
    expect(q.repeatabilityScore!).toBeGreaterThan(90);
    expect(q.paceCvPct!).toBeLessThan(2);
  });

  it("scores ragged interval reps lower", () => {
    const laps = [
      lap(1, 190),
      lap(2, 360),
      lap(3, 225),
      lap(4, 360),
      lap(5, 210),
      lap(6, 360),
      lap(7, 240),
    ];
    const q = computeWorkoutQuality(run(), fitWith({ laps }), cls("interval"));
    const tight = computeWorkoutQuality(
      run(),
      fitWith({ laps: [lap(1, 200), lap(2, 360), lap(3, 200), lap(4, 360), lap(5, 200)] }),
      cls("interval"),
    );
    expect(q.repeatabilityScore!).toBeLessThan(tight.repeatabilityScore!);
  });

  it("computes per-rep pace delta vs the work-rep median", () => {
    const laps = [lap(1, 200), lap(2, 360), lap(3, 220), lap(4, 360), lap(5, 200)];
    const q = computeWorkoutQuality(run(), fitWith({ laps }), cls("interval"));
    const deltas = q.reps.map((r) => r.paceDeltaPctVsMedian);
    expect(deltas.every((d) => d !== null)).toBe(true);
    // median of [200,220,200] = 200; the 220 rep is +10%.
    expect(Math.max(...(deltas as number[]))).toBeGreaterThan(5);
  });
});

describe("computeWorkoutQuality — aerobic decoupling", () => {
  it("is near zero when pace and HR hold steady", () => {
    const q = computeWorkoutQuality(
      run(),
      fitWith({
        paceStream: stream(20, () => 240, "paceSecPerKm"),
        hrStream: stream(20, () => 160, "hr"),
      }),
      cls("tempo"),
    );
    expect(q.decouplingPct).not.toBeNull();
    expect(Math.abs(q.decouplingPct!)).toBeLessThan(1);
  });

  it("is positive when HR climbs in the second half at the same pace", () => {
    const q = computeWorkoutQuality(
      run(),
      fitWith({
        paceStream: stream(20, () => 240, "paceSecPerKm"),
        hrStream: stream(20, (i) => (i < 10 ? 150 : 168), "hr"),
      }),
      cls("tempo"),
    );
    expect(q.decouplingPct!).toBeGreaterThan(5);
  });

  it("returns null decoupling when streams are too sparse", () => {
    const q = computeWorkoutQuality(
      run(),
      fitWith({
        paceStream: stream(4, () => 240, "paceSecPerKm"),
        hrStream: stream(4, () => 160, "hr"),
      }),
      cls("tempo"),
    );
    expect(q.decouplingPct).toBeNull();
    expect(q.limitations.join(" ")).toMatch(/decoupling/i);
  });
});

describe("computeWorkoutQuality — threshold control & applicability", () => {
  it("reports a threshold-control score for sustained tempo efforts", () => {
    const q = computeWorkoutQuality(
      run(),
      fitWith({
        laps: [lap(1, 240), lap(2, 242), lap(3, 239), lap(4, 241)],
        paceStream: stream(20, () => 240, "paceSecPerKm"),
        hrStream: stream(20, () => 160, "hr"),
      }),
      cls("tempo"),
    );
    expect(q.thresholdControlScore).not.toBeNull();
    expect(q.thresholdControlScore!).toBeGreaterThan(70);
  });

  it("does not report threshold control for interval sessions", () => {
    const q = computeWorkoutQuality(
      run(),
      fitWith({ laps: [lap(1, 200), lap(2, 360), lap(3, 200)] }),
      cls("interval"),
    );
    expect(q.thresholdControlScore).toBeNull();
  });

  it("marks easy runs as not applicable", () => {
    const q = computeWorkoutQuality(run(), fitWith({ laps: [lap(1, 330)] }), cls("easy"));
    expect(q.applicable).toBe(false);
  });

  it("degrades gracefully with no FIT data", () => {
    const q = computeWorkoutQuality(run(), null, cls("tempo"));
    expect(q.repeatabilityScore).toBeNull();
    expect(q.decouplingPct).toBeNull();
    expect(q.confidence).toBe("low");
    expect(q.limitations.join(" ")).toMatch(/no fit/i);
  });
});
