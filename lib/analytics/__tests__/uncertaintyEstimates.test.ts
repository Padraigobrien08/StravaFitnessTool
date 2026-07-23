import { describe, expect, it } from "vitest";
import { computeUncertaintyEstimates } from "../uncertaintyEstimates";
import type { RunActivity } from "@/lib/strava/types";
import type { RunWorkoutLabel, WorkoutType } from "../workoutType";

function mockRun(
  id: string,
  date: string,
  km: number,
  paceSec: number,
  avgHr: number,
): RunActivity {
  return {
    id,
    name: `Run ${id}`,
    date: `${date}T09:00:00.000Z`,
    distanceM: km * 1000,
    movingSec: Math.round(km * paceSec),
    elapsedSec: Math.round(km * paceSec),
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr,
    maxHr: avgHr + 12,
    elevationGainM: 20,
    calories: null,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: paceSec,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: 15,
  };
}

function label(runId: string, type: WorkoutType, date: string): RunWorkoutLabel {
  return {
    runId,
    date: `${date}T09:00:00.000Z`,
    runName: `Run ${runId}`,
    classification: { type, confidence: "high", signals: [] },
  };
}

/** Eight weekly easy runs (recent) with HR → efficiency, volume, and easy-pace cohorts all ≥5. */
function eightWeeklyRuns() {
  const dates = [
    "2026-06-01",
    "2026-06-08",
    "2026-06-15",
    "2026-06-22",
    "2026-06-29",
    "2026-07-06",
    "2026-07-13",
    "2026-07-20",
  ];
  const runs: RunActivity[] = [];
  const labels: RunWorkoutLabel[] = [];
  dates.forEach((d, i) => {
    runs.push(mockRun(`r${i}`, d, 10 + (i % 3), 300 + (i % 4) * 5, 148 + (i % 3)));
    labels.push(label(`r${i}`, "easy", d));
  });
  return { runs, labels };
}

describe("computeUncertaintyEstimates", () => {
  it("produces bootstrapped intervals for efficiency, volume, and easy pace", () => {
    const { runs, labels } = eightWeeklyRuns();
    const u = computeUncertaintyEstimates(runs, labels);
    expect(u.available).toBe(true);
    const keys = u.estimates.map((e) => e.key);
    expect(keys).toContain("aerobic_efficiency");
    expect(keys).toContain("weekly_volume");
    expect(keys).toContain("easy_pace");
    for (const e of u.estimates) {
      expect(e.lo).toBeLessThanOrEqual(e.point);
      expect(e.point).toBeLessThanOrEqual(e.hi);
      expect(e.n).toBeGreaterThanOrEqual(5);
      expect(e.interpretation.length).toBeGreaterThan(0);
      expect(e.ciPct).toBe(90);
    }
  });

  it("is unavailable when there are too few recent samples", () => {
    const runs = [
      mockRun("a", "2026-07-06", 10, 300, 150),
      mockRun("b", "2026-07-13", 10, 305, 150),
      mockRun("c", "2026-07-20", 10, 310, 150),
    ];
    const labels = [
      label("a", "easy", "2026-07-06"),
      label("b", "easy", "2026-07-13"),
      label("c", "easy", "2026-07-20"),
    ];
    const u = computeUncertaintyEstimates(runs, labels);
    expect(u.available).toBe(false);
    expect(u.limitations.length).toBeGreaterThan(0);
  });
});
