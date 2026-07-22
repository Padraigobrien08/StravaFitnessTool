import { describe, expect, it } from "vitest";
import {
  KM_PER_MILE,
  distanceUnitLabel,
  formatDistance,
  formatDistanceFromMeters,
  formatDistanceRange,
  formatDistanceValue,
  formatPaceInUnit,
  kmToMiles,
  milesToKm,
  paceUnitLabel,
} from "../units";

describe("conversion", () => {
  it("round-trips km ↔ miles", () => {
    expect(kmToMiles(KM_PER_MILE)).toBeCloseTo(1, 10);
    expect(milesToKm(1)).toBeCloseTo(KM_PER_MILE, 10);
    expect(kmToMiles(milesToKm(5))).toBeCloseTo(5, 10);
  });

  it("converts a marathon to ~26.2 miles", () => {
    expect(kmToMiles(42.195)).toBeCloseTo(26.219, 2);
  });
});

describe("formatDistance", () => {
  it("labels and keeps km unchanged", () => {
    expect(formatDistance(10, "km")).toBe("10 km");
    expect(formatDistance(412.34, "km")).toBe("412.3 km");
  });

  it("converts to miles with the mi label", () => {
    expect(formatDistance(10, "mi")).toBe("6.2 mi"); // 10 km ≈ 6.21 mi
    expect(formatDistance(KM_PER_MILE, "mi")).toBe("1 mi");
  });

  it("drops the trailing .0 for whole values", () => {
    expect(formatDistanceValue(8.0, "km")).toBe("8");
    expect(formatDistanceValue(0, "km")).toBe("0");
  });

  it("returns an em dash for non-finite input", () => {
    expect(formatDistance(Number.NaN, "km")).toBe("—");
    expect(formatDistanceValue(Number.POSITIVE_INFINITY, "mi")).toBe("—");
  });
});

describe("formatDistanceFromMeters", () => {
  it("divides meters to km then converts", () => {
    expect(formatDistanceFromMeters(5000, "km")).toBe("5 km");
    expect(formatDistanceFromMeters(1609.344, "mi")).toBe("1 mi");
  });
});

describe("formatDistanceRange", () => {
  it("uses a single trailing unit", () => {
    expect(formatDistanceRange(6, 8, "km")).toBe("6–8 km");
    expect(formatDistanceRange(16.09344, 32.18688, "mi")).toBe("10–20 mi");
  });
});

describe("formatPaceInUnit", () => {
  it("renders m:ss/km unchanged for metric", () => {
    expect(formatPaceInUnit(300, "min/km")).toBe("5:00/km");
    expect(formatPaceInUnit(272, "min/km")).toBe("4:32/km");
  });

  it("scales sec/km to sec/mi for imperial", () => {
    // 5:00/km → 5:00 * 1.609344 = 482.8s/mi → 8:03/mi
    expect(formatPaceInUnit(300, "min/mi")).toBe("8:03/mi");
  });

  it("carries a rounded 60s into the minutes place", () => {
    // 359.7s → 5:59.7 → rounds seconds to 60 → 6:00, not 5:60
    expect(formatPaceInUnit(359.7, "min/km")).toBe("6:00/km");
  });

  it("returns an em dash for invalid pace", () => {
    expect(formatPaceInUnit(0, "min/km")).toBe("—");
    expect(formatPaceInUnit(-5, "min/mi")).toBe("—");
    expect(formatPaceInUnit(Number.NaN, "min/km")).toBe("—");
  });
});

describe("labels", () => {
  it("maps units to short labels", () => {
    expect(distanceUnitLabel("km")).toBe("km");
    expect(distanceUnitLabel("mi")).toBe("mi");
    expect(paceUnitLabel("min/km")).toBe("/km");
    expect(paceUnitLabel("min/mi")).toBe("/mi");
  });
});
