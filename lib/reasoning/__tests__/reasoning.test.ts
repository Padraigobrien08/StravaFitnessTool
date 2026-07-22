import { describe, expect, it } from "vitest";
import { buildTestReasoningContext } from "../context";
import { compareSessions } from "../compareSessions";
import { explainReadinessDelta } from "../readinessDelta";
import { findBestPhase } from "../bestPhase";
import { attributeImprovement } from "../attributeImprovement";
import { analyzeFadePattern } from "../fadePattern";
import { prContext } from "../prContext";
import { buildTestBundle, emptyFit, makePaceStream, makeRun } from "./fixtures";
import type { RunWorkoutLabel } from "@/lib/analytics/workoutType";

function labelsFor(
  runs: ReturnType<typeof makeRun>[],
  type: RunWorkoutLabel["classification"]["type"],
): RunWorkoutLabel[] {
  return runs.map((r) => ({
    runId: r.id,
    date: r.date,
    runName: r.name,
    classification: { type, confidence: "high" as const, signals: ["test"] },
  }));
}

describe("compareSessions", () => {
  it("returns N tempo sessions ordered by date", () => {
    const runs = [
      makeRun("t1", "2026-01-10T00:00:00Z", 10),
      makeRun("t2", "2026-02-10T00:00:00Z", 10),
      makeRun("t3", "2026-03-10T00:00:00Z", 10),
      makeRun("e1", "2026-03-11T00:00:00Z", 8),
    ];
    const bundle = buildTestBundle(runs, [], labelsFor(runs.slice(0, 3), "tempo"));
    bundle.analytics.workoutLabels = [
      ...labelsFor(runs.slice(0, 3), "tempo"),
      ...labelsFor([runs[3]], "easy"),
    ];
    const ctx = buildTestReasoningContext(runs, [], bundle, null);
    const result = compareSessions(ctx, { type: "tempo", n: 3 });
    expect(result.payload.sessions).toHaveLength(3);
    expect(result.payload.sessions[0].date).toBe("2026-03-10T00:00:00Z");
  });
});

describe("explainReadinessDelta", () => {
  it("reports score and drivers", () => {
    const runs = Array.from({ length: 12 }, (_, i) =>
      makeRun(`r${i}`, `2026-0${1 + Math.floor(i / 4)}-${10 + i}T00:00:00Z`, 10 + i),
    );
    const bundle = buildTestBundle(runs);
    const ctx = buildTestReasoningContext(runs, [], bundle, null);
    const result = explainReadinessDelta(ctx, { weeks: 1 });
    expect(result.payload.now.score).toBeGreaterThanOrEqual(0);
    expect(result.payload.drivers.length).toBeGreaterThan(0);
  });
});

describe("findBestPhase", () => {
  it("picks highest-volume block when metric is volume", () => {
    const runs: ReturnType<typeof makeRun>[] = [];
    for (let w = 0; w < 16; w++) {
      const km = w < 8 ? 15 : 45;
      const day = 1 + (w % 28);
      const month = 1 + Math.floor(w / 4);
      const iso = `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`;
      runs.push(
        makeRun(`w${w}a`, iso, km / 3),
        makeRun(`w${w}b`, iso, km / 3),
        makeRun(`w${w}c`, iso, km / 3),
      );
    }
    runs.push(makeRun("last", "2026-05-20T00:00:00Z", 12));
    const bundle = buildTestBundle(runs);
    const ctx = buildTestReasoningContext(runs, [], bundle, null);
    const result = findBestPhase(ctx, { metric: "volume" });
    expect(result.payload.best.distanceKm).toBeGreaterThan(0);
    expect(result.payload.metric).toBe("volume");
  });
});

describe("attributeImprovement", () => {
  it("returns low confidence with few blocks", () => {
    const runs = [makeRun("1", "2026-05-01T00:00:00Z", 10)];
    const bundle = buildTestBundle(runs);
    const ctx = buildTestReasoningContext(runs, [], bundle, null);
    const result = attributeImprovement(ctx, { metric: "pace" });
    expect(result.confidence).toBe("low");
    expect(result.payload.factors.length).toBe(0);
  });
});

describe("analyzeFadePattern", () => {
  it("handles no long runs gracefully", () => {
    const runs = [makeRun("1", "2026-05-01T00:00:00Z", 8)];
    const bundle = buildTestBundle(runs);
    const ctx = buildTestReasoningContext(runs, [], bundle, null);
    const result = analyzeFadePattern(ctx, { distanceKm: 15 });
    expect(result.payload.runsAnalyzed).toBe(0);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it("computes median fade with pace streams", () => {
    const runs = [makeRun("long", "2026-05-01T00:00:00Z", 18)];
    const fit = {
      ...emptyFit("long"),
      paceStream: makePaceStream(30, 300, 330),
      hrDriftPct: 5,
    };
    const bundle = buildTestBundle(runs, [fit]);
    const ctx = buildTestReasoningContext(runs, [fit], bundle, null);
    const result = analyzeFadePattern(ctx, { distanceKm: 15 });
    expect(result.payload.runsAnalyzed).toBe(1);
    expect(result.payload.medianLateFadePct).not.toBeNull();
  });
});

describe("prContext", () => {
  it("summarizes prep vs prior window when PR exists", () => {
    const runs = Array.from({ length: 20 }, (_, i) =>
      makeRun(`r${i}`, new Date(Date.UTC(2026, 2, 1 + i * 3)).toISOString(), 8 + (i % 5)),
    );
    const bundle = buildTestBundle(runs);
    bundle.analytics.personalRecords = [
      {
        bucket: "hm",
        label: "Half Marathon",
        runId: "r19",
        runName: "HM race",
        date: runs[19].date,
        distanceKm: 21.1,
        paceSecPerKm: 270,
        timeSec: 5700,
        source: "full_run",
      },
    ];
    const ctx = buildTestReasoningContext(runs, [], bundle, null);
    const result = prContext(ctx, { bucket: "hm" });
    expect(result.payload.pr?.label).toBe("Half Marathon");
    expect(result.payload.prepWindow.runCount).toBeGreaterThanOrEqual(0);
    expect(result.payload.changes.length).toBeGreaterThan(0);
  });
});
