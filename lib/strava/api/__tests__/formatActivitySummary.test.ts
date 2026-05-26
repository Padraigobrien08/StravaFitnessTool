import { describe, expect, it } from "vitest";
import { formatActivitySummary } from "../formatActivitySummary";
import type { StravaActivityDetail } from "../fetchActivity";

describe("formatActivitySummary", () => {
  it("formats key fields", () => {
    const activity = {
      id: 1,
      name: "Morning Run",
      type: "Run",
      sport_type: "Run",
      distance: 10000,
      moving_time: 3000,
      elapsed_time: 3100,
      start_date: "2025-01-01T08:00:00Z",
      average_speed: 3.33,
      average_heartrate: 150,
      total_elevation_gain: 50,
    } as StravaActivityDetail;

    const text = formatActivitySummary(activity);
    expect(text).toContain("Morning Run");
    expect(text).toContain("10.00 km");
    expect(text).toContain("150 bpm");
  });
});
