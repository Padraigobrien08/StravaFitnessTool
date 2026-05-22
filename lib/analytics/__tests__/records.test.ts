import { describe, expect, it } from "vitest";
import { findPersonalRecords } from "../records";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";

const longRun: RunActivity = {
  id: "1",
  date: "2026-05-09T00:00:00.000Z",
  name: "Long easy",
  distanceM: 20470,
  elapsedSec: 6800,
  movingSec: 6787,
  avgSpeedMps: 3.016,
  maxSpeedMps: 3.76,
  avgHr: 171,
  maxHr: 189,
  elevationGainM: 200,
  calories: 1786,
  relativeEffort: 290,
  trainingLoad: 1868,
  gradeAdjustedPaceSecPerKm: null,
  avgCadence: 78,
  totalSteps: null,
  weatherTempC: null,
};

describe("findPersonalRecords", () => {
  it("prefers FIT segment over slower full-run 10K", () => {
    const fit: FitRunDetail = {
      activityId: "1",
      bestEfforts: [
        {
          key: "10k",
          label: "10K",
          distanceM: 10000,
          timeSec: 2400,
          paceSecPerKm: 240,
          startElapsedSec: 1800,
          source: "segment",
        },
      ],
      laps: [],
      hrStream: [],
      paceStream: [],
      cadenceStream: [],
      hrDriftPct: null,
      avgCadence: null,
    };

    const standalone10k: RunActivity = {
      ...longRun,
      id: "2",
      name: "Standalone 10K",
      distanceM: 10000,
      movingSec: 3600,
      elapsedSec: 3600,
    };

    const prs = findPersonalRecords([longRun, standalone10k], [fit]);
    const tenK = prs.find((p) => p.bucket === "10k");
    expect(tenK?.runId).toBe("1");
    expect(tenK?.source).toBe("segment");
    expect(tenK?.timeSec).toBe(2400);
  });
});
