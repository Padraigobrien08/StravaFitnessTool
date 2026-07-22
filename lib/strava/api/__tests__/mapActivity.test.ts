import { describe, expect, it } from "vitest";
import { mapStravaActivityToRun } from "../mapActivity";
import type { StravaActivity } from "../types";

const base: StravaActivity = {
  id: 12345,
  name: "Morning Run",
  type: "Run",
  sport_type: "Run",
  distance: 10000,
  moving_time: 3000,
  elapsed_time: 3100,
  start_date: "2024-06-01T08:00:00Z",
  average_speed: 3.33,
  average_heartrate: 150,
};

describe("mapStravaActivityToRun", () => {
  it("maps runs to RunActivity", () => {
    const run = mapStravaActivityToRun(base);
    expect(run).not.toBeNull();
    expect(run!.id).toBe("12345");
    expect(run!.distanceM).toBe(10000);
    expect(run!.avgHr).toBe(150);
  });

  it("returns null for non-run sports", () => {
    expect(mapStravaActivityToRun({ ...base, sport_type: "Ride", type: "Ride" })).toBeNull();
  });
});
