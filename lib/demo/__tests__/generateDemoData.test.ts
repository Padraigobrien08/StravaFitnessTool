import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { buildDemoImport, demoRaceGoal, DEMO_EXPORT_LABEL } from "../generateDemoData";
import { StravaImportSchema } from "@/lib/strava/types";
import { computeInsights } from "@/lib/analytics";

const NOW = new Date("2026-07-17T09:00:00.000Z");

/**
 * Pinned clock. The fixture data is generated from NOW, but `computeInsights` reads
 * the real clock for recency and days-until-race, so the readiness score drifted as
 * real time advanced past the demo athlete's race date.
 */
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("buildDemoImport", () => {
  const demo = buildDemoImport(NOW);

  it("passes StravaImportSchema (safe for saveImport)", () => {
    expect(() => StravaImportSchema.parse(demo)).not.toThrow();
  });

  it("produces a high-confidence volume of runs (~12 months)", () => {
    expect(demo.runs.length).toBeGreaterThanOrEqual(120);
    const first = new Date(demo.runs[0].date).getTime();
    const last = new Date(demo.runs[demo.runs.length - 1].date).getTime();
    const spanDays = (last - first) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThan(330);
  });

  it("carries the fields the engines need on every run", () => {
    for (const r of demo.runs) {
      expect(r.avgHr).not.toBeNull();
      expect(r.distanceM).toBeGreaterThan(0);
      expect(r.movingSec).toBeGreaterThan(0);
    }
    const withLoad = demo.runs.filter((r) => r.trainingLoad !== null).length;
    expect(withLoad / demo.runs.length).toBeGreaterThan(0.5);
  });

  it("omits fitFilename (no false 'import FIT' warning in a client demo)", () => {
    expect(demo.runs.every((r) => r.fitFilename === undefined)).toBe(true);
  });

  it("includes 5K and 10K prediction/PR anchors", () => {
    const has5k = demo.runs.some((r) => r.distanceM >= 4500 && r.distanceM <= 5500);
    const has10k = demo.runs.some((r) => r.distanceM >= 9500 && r.distanceM <= 10500);
    expect(has5k).toBe(true);
    expect(has10k).toBe(true);
  });

  it("seeds cross-training across multiple modalities for the ecosystem", () => {
    const nonRun = demo.allActivities.filter((a) => a.type !== "Run" && a.type !== "TrailRun");
    expect(nonRun.length).toBeGreaterThanOrEqual(6);
    expect(new Set(nonRun.map((a) => a.type)).size).toBeGreaterThanOrEqual(2);
  });

  it("mirrors every run into allActivities by id", () => {
    const summaryIds = new Set(demo.allActivities.map((a) => a.id));
    for (const r of demo.runs) expect(summaryIds.has(r.id)).toBe(true);
  });

  it("is deterministic for a given `now`", () => {
    expect(buildDemoImport(NOW)).toEqual(buildDemoImport(NOW));
  });

  it("uses the demo export label", () => {
    expect(demo.exportLabel).toBe(DEMO_EXPORT_LABEL);
  });

  it("drives a populated race-readiness story via computeInsights", () => {
    const goal = demoRaceGoal(NOW);
    const insights = computeInsights(demo, [], 4, goal, 0);
    expect(insights.raceReadiness).not.toBeNull();
    // Sub-1:45 HM build ~9 weeks out: on-track with concrete gaps to close.
    expect(insights.raceReadiness!.score).toBeGreaterThan(60);
    expect(insights.raceReadiness!.gaps.length).toBeGreaterThan(0);
  });
});
