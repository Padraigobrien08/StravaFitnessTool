import { describe, expect, it } from "vitest";
import { compactActivityStreams } from "../compactStreams";
import type { StravaStreamSet } from "../types";

describe("compactActivityStreams", () => {
  it("returns raw arrays and metadata", () => {
    const streams: StravaStreamSet = {
      time: {
        data: [0, 1, 2],
        series_type: "time",
        original_size: 3,
        resolution: "high",
      },
      heartrate: {
        data: [140, 145, 150],
        series_type: "time",
        original_size: 3,
        resolution: "high",
      },
    };

    const compact = compactActivityStreams(42, streams);
    expect(compact).not.toBeNull();
    expect(compact!.activityId).toBe(42);
    expect(compact!.pointCount).toBe(3);
    expect(compact!.streams.time).toEqual([0, 1, 2]);
    expect(compact!.streams.heartrate).toEqual([140, 145, 150]);
    expect(compact!.meta.time.unit).toBe("s");
  });

  it("returns null when streams empty", () => {
    expect(compactActivityStreams(1, null)).toBeNull();
    expect(compactActivityStreams(1, {})).toBeNull();
  });
});
