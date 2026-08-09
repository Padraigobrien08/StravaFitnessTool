import { describe, expect, it } from "vitest";
import { assessImportQuality } from "../assessImport";
import type { RunActivity, StravaImport } from "@/lib/strava/types";

/**
 * Field coverage drives `overallConfidence`, which `wrapIntelligence` attaches to every
 * tool result the Coach and the HTTP API return. It had no direct test: the function was
 * only ever exercised incidentally, by suites asserting something further downstream.
 *
 * That mattered when `mapStravaImport` was removed. The counts used to run over a
 * re-shaped copy of every run, reading `avgHeartRate`; they now read `avgHr` off the
 * parsed run. The compiler proves the field exists — it cannot prove it is the *right*
 * field, and counting the wrong one would silently mislabel confidence everywhere
 * rather than fail anything.
 */

function run(id: string, over: Partial<RunActivity> = {}): RunActivity {
  return {
    id,
    name: `Run ${id}`,
    date: "2026-01-15",
    distanceM: 10_000,
    movingSec: 3000,
    elapsedSec: 3050,
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr: null,
    maxHr: null,
    elevationGainM: null,
    calories: null,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
    ...over,
  };
}

function importOf(runs: RunActivity[], over: Partial<StravaImport> = {}): StravaImport {
  return {
    runs,
    allActivities: runs.map((r) => ({
      id: r.id,
      date: r.date,
      name: r.name,
      type: "Run",
      distanceM: r.distanceM,
      elapsedSec: r.elapsedSec,
    })),
    profile: { maxHeartRate: null, athleteType: null, ftp: null, measurementPreference: null },
    goals: [],
    importedAt: "2026-01-20T00:00:00.000Z",
    ...over,
  } as StravaImport;
}

const coverage = (data: StravaImport, label: string) =>
  assessImportQuality(data).fieldCoverage.find((f) => f.label === label)!;

describe("field coverage counts the parsed fields", () => {
  it("counts heart rate from avgHr", () => {
    const data = importOf([run("1", { avgHr: 150 }), run("2", { avgHr: 148 }), run("3")]);
    expect(coverage(data, "Heart rate")).toMatchObject({ count: 2, total: 3 });
  });

  // Zero is a real heart rate reading in the sense that matters here: it is present.
  // A truthiness check would drop it, so the filter must test for null.
  it("does not drop a present-but-zero reading", () => {
    const data = importOf([run("1", { avgHr: 0 })]);
    expect(coverage(data, "Heart rate").count).toBe(1);
  });

  it("counts elevation, load and cadence independently", () => {
    const data = importOf([
      run("1", { elevationGainM: 120 }),
      run("2", { trainingLoad: 80 }),
      run("3", { avgCadence: 170 }),
    ]);
    expect(coverage(data, "Elevation").count).toBe(1);
    expect(coverage(data, "Training load").count).toBe(1);
    expect(coverage(data, "Cadence").count).toBe(1);
  });

  it("reports full coverage as high and none as low", () => {
    const all = importOf([run("1", { avgHr: 150 }), run("2", { avgHr: 150 })]);
    const none = importOf([run("1"), run("2")]);
    expect(coverage(all, "Heart rate").level).toBe("high");
    expect(coverage(none, "Heart rate").level).toBe("low");
  });

  it("survives an empty import without dividing by zero", () => {
    const report = assessImportQuality(importOf([]));
    expect(report.runCount).toBe(0);
    expect(report.fieldCoverage.every((f) => Number.isFinite(f.count))).toBe(true);
  });
});

describe("overall confidence", () => {
  const withHr = (n: number, hr: number) =>
    Array.from({ length: n }, (_, i) => run(`r${i}`, i < hr ? { avgHr: 150 } : {}));

  it("reaches high only with volume and HR together", () => {
    // 40 runs is the documented floor, and 85% HR coverage the documented ratio.
    expect(assessImportQuality(importOf(withHr(40, 40))).overallConfidence).toBe("high");
    // Same HR coverage, too few runs.
    expect(assessImportQuality(importOf(withHr(20, 20))).overallConfidence).not.toBe("high");
    // Enough runs, not enough HR.
    expect(assessImportQuality(importOf(withHr(40, 20))).overallConfidence).not.toBe("high");
  });

  it("warns when HR is thin rather than staying silent", () => {
    const report = assessImportQuality(importOf(withHr(40, 4)));
    expect(report.warnings.join(" ")).toMatch(/lack HR/);
  });

  it("warns on a small sample", () => {
    const report = assessImportQuality(importOf(withHr(5, 5)));
    expect(report.warnings.join(" ")).toMatch(/Small sample size/);
  });
});
