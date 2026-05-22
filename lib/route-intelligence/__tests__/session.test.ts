import { describe, expect, it } from "vitest";
import { buildRouteIntelligenceSession } from "../buildSession";
import { buildTimelineFromStreams } from "../timeline";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";

const run: RunActivity = {
  id: "gps-1",
  date: "2026-05-01T00:00:00Z",
  name: "GPS test",
  distanceM: 10000,
  elapsedSec: 3600,
  movingSec: 3500,
  avgSpeedMps: 2.8,
  maxSpeedMps: 4,
  avgHr: 155,
  maxHr: 175,
  elevationGainM: 120,
  calories: 600,
  relativeEffort: 100,
  trainingLoad: 400,
  gradeAdjustedPaceSecPerKm: null,
  avgCadence: 80,
  totalSteps: null,
  weatherTempC: null,
};

const fit: FitRunDetail = {
  activityId: "gps-1",
  bestEfforts: [],
  laps: [
    {
      index: 1,
      distanceM: 5000,
      timeSec: 1500,
      avgHr: 150,
      avgPaceSecPerKm: 300,
      avgCadence: 80,
    },
  ],
  hrStream: [
    { elapsedSec: 0, hr: 140 },
    { elapsedSec: 1500, hr: 160 },
  ],
  paceStream: [
    { elapsedSec: 0, paceSecPerKm: 300 },
    { elapsedSec: 750, paceSecPerKm: 290 },
    { elapsedSec: 1500, paceSecPerKm: 320 },
  ],
  cadenceStream: [],
  gpsStream: [
    { elapsedSec: 0, lat: 53.35, lon: -6.26, elevationM: 10 },
    { elapsedSec: 750, lat: 53.36, lon: -6.25, elevationM: 45 },
    { elapsedSec: 1500, lat: 53.37, lon: -6.24, elevationM: 20 },
  ],
  hrDriftPct: 5,
  avgCadence: 80,
};

describe("buildTimelineFromStreams", () => {
  it("merges GPS with interpolated HR/pace", () => {
    const tl = buildTimelineFromStreams(fit);
    expect(tl).toHaveLength(3);
    expect(tl[1].hr).toBeGreaterThan(140);
    expect(tl[1].paceSecPerKm).toBeLessThan(310);
  });
});

describe("buildRouteIntelligenceSession", () => {
  it("builds geometry and overlays", () => {
    const session = buildRouteIntelligenceSession(run, fit, "tempo");
    expect(session.hasGps).toBe(true);
    expect(session.geometry).not.toBeNull();
    expect(session.geometry!.totalDistanceM).toBeGreaterThan(1000);
    expect(session.timeline.length).toBe(3);
  });
});
