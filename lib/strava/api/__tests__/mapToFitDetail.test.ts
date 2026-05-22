import { describe, expect, it } from "vitest";
import { mapStravaLaps, mapStravaStreamsToFitDetail } from "../mapToFitDetail";
import type { StravaLap, StravaStreamSet } from "../types";

describe("mapStravaStreamsToFitDetail", () => {
  it("builds pace and HR streams from Strava stream set", () => {
    const streams: StravaStreamSet = {
      time: {
        data: [0, 60, 120],
        series_type: "time",
        original_size: 3,
        resolution: "high",
      },
      heartrate: {
        data: [140, 145, 150],
        series_type: "distance",
        original_size: 3,
        resolution: "high",
      },
      velocity_smooth: {
        data: [3.5, 3.4, 3.3],
        series_type: "distance",
        original_size: 3,
        resolution: "high",
      },
      cadence: {
        data: [85, 86, 87],
        series_type: "distance",
        original_size: 3,
        resolution: "high",
      },
    };
    const detail = mapStravaStreamsToFitDetail("99", streams, []);
    expect(detail).not.toBeNull();
    expect(detail!.paceStream.length).toBeGreaterThan(0);
    expect(detail!.hrStream.length).toBe(3);
    expect(detail!.cadenceStream.length).toBe(3);
  });

  it("maps latlng and altitude into gpsStream", () => {
    const streams: StravaStreamSet = {
      time: {
        data: [0, 60],
        series_type: "time",
        original_size: 2,
        resolution: "high",
      },
      latlng: {
        data: [
          [53.35, -6.26],
          [53.36, -6.25],
        ],
        series_type: "distance",
        original_size: 2,
        resolution: "high",
      },
      altitude: {
        data: [10, 25],
        series_type: "distance",
        original_size: 2,
        resolution: "high",
      },
    };
    const detail = mapStravaStreamsToFitDetail("gps", streams, []);
    expect(detail?.gpsStream).toHaveLength(2);
    expect(detail?.gpsStream[0].lat).toBeCloseTo(53.35);
    expect(detail?.gpsStream[1].elevationM).toBe(25);
  });

  it("maps laps to best efforts when no streams", () => {
    const laps: StravaLap[] = [
      {
        lap_index: 1,
        distance: 5000,
        elapsed_time: 1500,
        average_speed: 3.33,
        average_heartrate: 155,
      },
    ];
    const detail = mapStravaStreamsToFitDetail("1", null, laps);
    expect(detail?.laps).toHaveLength(1);
    expect(detail?.laps[0].distanceM).toBe(5000);
  });
});

describe("mapStravaLaps", () => {
  it("converts average speed to pace", () => {
    const laps = mapStravaLaps([
      {
        lap_index: 1,
        distance: 1000,
        elapsed_time: 300,
        average_speed: 3.33,
      },
    ]);
    expect(laps[0].avgPaceSecPerKm).toBeCloseTo(300.3, 0);
  });
});
