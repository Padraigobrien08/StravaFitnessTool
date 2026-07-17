import { describe, expect, it } from "vitest";
import { buildActivityGpx } from "../formatWorkoutFile";
import type { StravaStreamSet } from "../types";

describe("buildActivityGpx", () => {
  it("builds minimal gpx from latlng and time", () => {
    const streams: StravaStreamSet = {
      latlng: {
        data: [
          [53.0, -6.0],
          [53.01, -6.01],
        ] as [number, number][],
        series_type: "distance",
        original_size: 2,
        resolution: "high",
      },
      time: {
        data: [0, 60],
        series_type: "time",
        original_size: 2,
        resolution: "high",
      },
    };

    const gpx = buildActivityGpx(99, "Test Run", streams);
    expect(gpx).toContain("<gpx");
    expect(gpx).toContain("Test Run");
    expect(gpx).toContain('lat="53"');
  });

  it("throws without gps", () => {
    expect(() => buildActivityGpx(1, "X", null)).toThrow(/No GPS/);
  });
});
