import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { computePersonalZScores } from "../personalZScores";
import type { RunActivity } from "@/lib/strava/types";
import type { RunWorkoutLabel, WorkoutType } from "../workoutType";

const ANCHOR = "2026-07-20T09:00:00.000Z";

/**
 * Pinned to the same anchor the fixtures use (D-8 class, as in #117).
 *
 * The sessions below are dated relative to a fixed instant, but the standout window
 * `computePersonalZScores` applies is relative to `Date.now()`. That was fine while
 * the anchor was recent and becomes a failure once enough real time passes — a test
 * with an expiry date rather than a bug. Found by running the suite with the clock
 * moved forward; it was still green 18 days past the anchor and failed at four months.
 */
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(new Date(ANCHOR));
});
afterAll(() => vi.useRealTimers());

/** Recent dates so sessions land inside the standout window. */
function dateNDaysAgo(n: number): string {
  const d = new Date(ANCHOR);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function mockRun(id: string, gapPace: number, avgHr: number | null, daysAgo: number): RunActivity {
  return {
    id,
    name: `Run ${id}`,
    date: dateNDaysAgo(daysAgo),
    distanceM: 8000,
    movingSec: Math.round(8 * gapPace),
    elapsedSec: Math.round(8 * gapPace),
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr,
    maxHr: avgHr != null ? avgHr + 10 : null,
    elevationGainM: 20,
    calories: null,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: gapPace,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  };
}

function label(runId: string, type: WorkoutType, daysAgo: number): RunWorkoutLabel {
  return {
    runId,
    date: dateNDaysAgo(daysAgo),
    runName: `Run ${runId}`,
    classification: { type, confidence: "high", signals: [] },
  };
}

/** Six tempos with the given grade-adjusted paces; no HR unless `withHr`. */
function tempoCohort(paces: number[], withHr = false) {
  const runs: RunActivity[] = [];
  const labels: RunWorkoutLabel[] = [];
  paces.forEach((p, i) => {
    runs.push(mockRun(`t${i}`, p, withHr ? 150 : null, i));
    labels.push(label(`t${i}`, "tempo", i));
  });
  return { runs, labels };
}

describe("computePersonalZScores", () => {
  it("scores the fastest session high and the slowest low, mean near zero", () => {
    const { runs, labels } = tempoCohort([300, 300, 300, 300, 240, 360]);
    const z = computePersonalZScores(runs, labels);
    expect(z.available).toBe(true);
    const fast = z.sessions.find((s) => s.runId === "t4")!; // 240 = fastest
    const slow = z.sessions.find((s) => s.runId === "t5")!; // 360 = slowest
    const mid = z.sessions.find((s) => s.runId === "t0")!; // 300 = mean
    expect(fast.paceZ!).toBeGreaterThan(1);
    expect(slow.paceZ!).toBeLessThan(-1);
    expect(Math.abs(mid.paceZ!)).toBeLessThan(0.5);
    expect(fast.primaryMetric).toBe("pace");
  });

  it("prefers efficiency as the primary metric when HR is present", () => {
    const { runs, labels } = tempoCohort([300, 300, 300, 240, 360, 300], true);
    const z = computePersonalZScores(runs, labels);
    expect(z.sessions.every((s) => s.primaryMetric === "efficiency")).toBe(true);
    expect(z.sessions.every((s) => s.efficiencyZ != null)).toBe(true);
  });

  it("picks the standout best and worst recent sessions", () => {
    const { runs, labels } = tempoCohort([300, 300, 300, 300, 240, 360]);
    const z = computePersonalZScores(runs, labels);
    expect(z.standouts.best?.runId).toBe("t4");
    expect(z.standouts.worst?.runId).toBe("t5");
  });

  it("is unavailable when no cohort reaches three comparable sessions", () => {
    const runs = [mockRun("t0", 300, null, 0), mockRun("t1", 290, null, 1)];
    const labels = [label("t0", "tempo", 0), label("t1", "tempo", 1)];
    const z = computePersonalZScores(runs, labels);
    expect(z.available).toBe(false);
    expect(z.limitations.length).toBeGreaterThan(0);
  });

  it("yields no score when the cohort has no spread (sd ≈ 0)", () => {
    const { runs, labels } = tempoCohort([300, 300, 300, 300, 300, 300]);
    const z = computePersonalZScores(runs, labels);
    // Every pace identical → no distribution to score against → unavailable.
    expect(z.available).toBe(false);
  });
});
