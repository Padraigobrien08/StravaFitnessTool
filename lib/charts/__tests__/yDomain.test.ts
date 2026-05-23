import { describe, expect, it } from "vitest";
import { minMaxYDomain, minMaxYDomainReversed } from "../yDomain";

describe("minMaxYDomain", () => {
  it("pads min and max", () => {
    const [lo, hi] = minMaxYDomain([6000, 6200, 6100], {
      filterOutliers: false,
      paddingMin: 30,
    });
    expect(lo).toBeLessThan(6000);
    expect(hi).toBeGreaterThan(6200);
  });

  it("drops extreme outliers for display", () => {
    const cluster = [6500, 6600, 6550, 6580];
    const withOutlier = [...cluster, 12000];
    const [lo, hi] = minMaxYDomain(withOutlier, { filterOutliers: true });
    expect(lo).toBeGreaterThan(5000);
    expect(hi).toBeLessThan(8000);
  });
});

describe("minMaxYDomainReversed", () => {
  it("returns high-to-low for reversed pace axis", () => {
    const [top, bottom] = minMaxYDomainReversed([307, 312, 317], {
      filterOutliers: false,
      paddingMin: 5,
    });
    expect(top).toBeGreaterThan(bottom);
    expect(top).toBeGreaterThan(317);
    expect(bottom).toBeLessThan(307);
  });
});
