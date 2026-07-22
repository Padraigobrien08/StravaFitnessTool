import { describe, expect, it } from "vitest";
import { mergeStravaImports } from "../mergeImport";
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
