import { describe, expect, it } from "vitest";
import {
  fitDetailHasGps,
  fitDetailNeedsGpsRefresh,
  isEmptyFitDetail,
} from "../fitStreamCompleteness";
import type { FitRunDetail } from "../fitTypes";

const base: FitRunDetail = {
  activityId: "1",
  bestEfforts: [],
  laps: [],
  hrStream: [{ elapsedSec: 0, hr: 140 }],
  paceStream: [{ elapsedSec: 0, paceSecPerKm: 300 }],
  cadenceStream: [],
  gpsStream: [],
  hrDriftPct: null,
  avgCadence: null,
};

describe("fitStreamCompleteness", () => {
  it("treats pace-only cache as needing GPS refresh", () => {
    expect(isEmptyFitDetail(base)).toBe(false);
    expect(fitDetailHasGps(base)).toBe(false);
    expect(fitDetailNeedsGpsRefresh(base)).toBe(true);
  });

  it("detects valid GPS", () => {
    const withGps = {
      ...base,
      gpsStream: [
        { elapsedSec: 0, lat: 53.3, lon: -6.2 },
        { elapsedSec: 60, lat: 53.31, lon: -6.19 },
      ],
    };
    expect(fitDetailHasGps(withGps)).toBe(true);
    expect(fitDetailNeedsGpsRefresh(withGps)).toBe(false);
  });
});
