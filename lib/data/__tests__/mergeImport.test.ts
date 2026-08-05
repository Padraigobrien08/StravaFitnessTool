import { describe, expect, it } from "vitest";
import { enrichImportWithFitDetails, mergeStravaImports } from "../mergeImport";
import type { StravaImport } from "@/lib/strava/types";

const baseRun = (id: string, name: string): StravaImport["runs"][0] => ({
  id,
  date: "2024-01-01T10:00:00.000Z",
  name,
  distanceM: 5000,
  elapsedSec: 1500,
  movingSec: 1500,
  avgSpeedMps: 3.3,
  maxSpeedMps: 4,
  avgHr: 150,
  maxHr: 170,
  elevationGainM: 10,
  calories: 300,
  relativeEffort: 50,
  trainingLoad: 40,
  gradeAdjustedPaceSecPerKm: null,
  avgCadence: 80,
  totalSteps: null,
  weatherTempC: null,
});

const emptyImport = (): StravaImport => ({
  runs: [],
  profile: {
    maxHeartRate: null,
    athleteType: null,
    ftp: null,
    measurementPreference: null,
  },
  goals: [],
  allActivities: [],
  importedAt: "2024-01-01T00:00:00.000Z",
  fitRunIds: [],
});

describe("mergeStravaImports", () => {
  it("keeps runs from both sources", () => {
    const local: StravaImport = {
      ...emptyImport(),
      runs: [baseRun("1", "Local only")],
      exportLabel: "export_folder",
    };
    const api: StravaImport = {
      ...emptyImport(),
      runs: [baseRun("2", "API only")],
      exportLabel: "Strava API",
    };
    const merged = mergeStravaImports(local, api)!;
    expect(merged.runs.map((r) => r.id).sort()).toEqual(["1", "2"]);
    expect(merged.exportLabel).toContain("export_folder");
    expect(merged.exportLabel).toContain("Strava API");
  });

  it("overlay replaces same id", () => {
    const local: StravaImport = {
      ...emptyImport(),
      runs: [baseRun("1", "Old name")],
    };
    const api: StravaImport = {
      ...emptyImport(),
      runs: [{ ...baseRun("1", "From API"), avgHr: 160 }],
    };
    const merged = mergeStravaImports(local, api)!;
    expect(merged.runs).toHaveLength(1);
    expect(merged.runs[0].name).toBe("From API");
    expect(merged.runs[0].avgHr).toBe(160);
  });

  it("unions fitRunIds", () => {
    const a = { ...emptyImport(), fitRunIds: ["1", "2"] };
    const b = { ...emptyImport(), fitRunIds: ["2", "3"] };
    expect(mergeStravaImports(a, b)!.fitRunIds.sort()).toEqual(["1", "2", "3"]);
  });
});

/**
 * Source precedence, field by field.
 *
 * The export and the API are not interchangeable: `mapActivity` hard-codes
 * trainingLoad, gradeAdjustedPaceSecPerKm, totalSteps and weatherTempC to null and
 * never sets fitFilename, because the API does not expose them. Whole-record
 * replacement therefore deleted them on every sync-after-import.
 */
describe("source precedence", () => {
  /** A run as the CSV export produces it: every field populated. */
  const fromExport = (id = "1"): StravaImport["runs"][0] => ({
    ...baseRun(id, "Export name"),
    distanceM: 10000,
    movingSec: 3000,
    trainingLoad: 88,
    gradeAdjustedPaceSecPerKm: 295,
    totalSteps: 8500,
    weatherTempC: 14,
    description: "felt good",
    fitFilename: "activities/1.fit.gz",
  });

  /** The same run as `lib/strava/api/mapActivity.ts` produces it. */
  const fromApi = (id = "1"): StravaImport["runs"][0] => ({
    ...baseRun(id, "Corrected name"),
    distanceM: 10120, // athlete fixed the distance on Strava — API is authoritative
    movingSec: 2990,
    avgHr: 152,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: null,
    totalSteps: null,
    weatherTempC: null,
    fitFilename: undefined,
  });

  const wrap = (runs: StravaImport["runs"], label: string, at: string): StravaImport => ({
    ...emptyImport(),
    runs,
    exportLabel: label,
    importedAt: at,
  });

  const exportImport = () => wrap([fromExport()], "export_folder", "2026-08-01T00:00:00.000Z");
  const apiImport = () => wrap([fromApi()], "Strava API", "2026-08-02T00:00:00.000Z");

  it("the overlay wins on every field it carries", () => {
    const run = mergeStravaImports(exportImport(), apiImport())!.runs[0];
    expect(run.name).toBe("Corrected name");
    expect(run.distanceM).toBe(10120);
    expect(run.movingSec).toBe(2990);
    expect(run.avgHr).toBe(152);
  });

  // The regression: these five exist only in the export.
  it("keeps export-only fields when the API overlays and has none", () => {
    const run = mergeStravaImports(exportImport(), apiImport())!.runs[0];
    expect(run.trainingLoad).toBe(88);
    expect(run.gradeAdjustedPaceSecPerKm).toBe(295);
    expect(run.totalSteps).toBe(8500);
    expect(run.weatherTempC).toBe(14);
    expect(run.fitFilename).toBe("activities/1.fit.gz");
  });

  /**
   * The property that matters most: the merge is information-preserving whichever
   * import ran last. Precedence used to be "most recent import wins wholesale", so
   * import-then-sync and sync-then-import produced different data for the same run.
   */
  it("preserves the union of both sources in either order", () => {
    const exportThenApi = mergeStravaImports(exportImport(), apiImport())!.runs[0];
    const apiThenExport = mergeStravaImports(apiImport(), exportImport())!.runs[0];

    for (const run of [exportThenApi, apiThenExport]) {
      expect(run.trainingLoad).toBe(88);
      expect(run.gradeAdjustedPaceSecPerKm).toBe(295);
      expect(run.totalSteps).toBe(8500);
      expect(run.weatherTempC).toBe(14);
      expect(run.fitFilename).toBe("activities/1.fit.gz");
    }
    // Order still decides the genuinely conflicting fields — whichever came last wins.
    expect(exportThenApi.distanceM).toBe(10120);
    expect(apiThenExport.distanceM).toBe(10000);
  });

  it("does not resurrect a field neither source carries", () => {
    const merged = mergeStravaImports(
      wrap([{ ...fromExport(), weatherTempC: null }], "a", "2026-08-01T00:00:00.000Z"),
      wrap([{ ...fromApi() }], "b", "2026-08-02T00:00:00.000Z"),
    )!;
    expect(merged.runs[0].weatherTempC).toBeNull();
  });

  it("leaves records unique to one side untouched", () => {
    const merged = mergeStravaImports(
      wrap([fromExport("1")], "a", "2026-08-01T00:00:00.000Z"),
      wrap([fromApi("2")], "b", "2026-08-02T00:00:00.000Z"),
    )!;
    expect(merged.runs).toHaveLength(2);
    expect(merged.runs.find((r) => r.id === "1")!.trainingLoad).toBe(88);
    expect(merged.runs.find((r) => r.id === "2")!.trainingLoad).toBeNull();
  });

  it("merges allActivities field-wise too", () => {
    const summary = (o: Record<string, unknown> = {}) => ({
      id: "a1",
      date: "2026-08-01T10:00:00.000Z",
      name: "Ride",
      type: "Ride",
      distanceM: 20000,
      movingSec: 3600,
      elapsedSec: 3700,
      elevationGainM: 200,
      avgHr: 130,
      calories: 500,
      ...o,
    });
    const merged = mergeStravaImports(
      { ...emptyImport(), allActivities: [summary() as never] },
      {
        ...emptyImport(),
        allActivities: [summary({ name: "Evening Ride", calories: null }) as never],
      },
    )!;
    const a = merged.allActivities[0] as unknown as { name: string; calories: number | null };
    expect(a.name).toBe("Evening Ride"); // overlay wins where it has a value
    expect(a.calories).toBe(500); // base survives where the overlay is null
  });

  it("keeps the later importedAt regardless of argument order", () => {
    expect(mergeStravaImports(exportImport(), apiImport())!.importedAt).toBe(
      "2026-08-02T00:00:00.000Z",
    );
    expect(mergeStravaImports(apiImport(), exportImport())!.importedAt).toBe(
      "2026-08-02T00:00:00.000Z",
    );
  });
});

describe("enrichImportWithFitDetails", () => {
  it("adds FIT ids without disturbing run fields — the third source is id-only", () => {
    const before: StravaImport = {
      ...emptyImport(),
      runs: [{ ...baseRun("1", "Run"), trainingLoad: 88 }],
      fitRunIds: ["1"],
    };
    const after = enrichImportWithFitDetails(before, [{ activityId: "2" }, { activityId: "1" }]);
    expect(after.fitRunIds.sort()).toEqual(["1", "2"]);
    expect(after.runs[0].trainingLoad).toBe(88);
    expect(after.runs).toEqual(before.runs);
  });
});
