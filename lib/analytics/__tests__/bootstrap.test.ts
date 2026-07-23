import { describe, expect, it } from "vitest";
import { bootstrapMeanCI } from "../bootstrap";

describe("bootstrapMeanCI", () => {
  const spread = [1, 20, 3, 18, 5, 15, 2, 19, 4, 17];
  const tight = [10, 10, 10, 10, 11, 9, 10, 10, 10, 10];

  it("is deterministic for a fixed seed", () => {
    const a = bootstrapMeanCI(spread, { seed: 7 });
    const b = bootstrapMeanCI(spread, { seed: 7 });
    expect(a).toEqual(b);
  });

  it("brackets the point estimate (lo ≤ point ≤ hi)", () => {
    const ci = bootstrapMeanCI(spread)!;
    expect(ci.lo).toBeLessThanOrEqual(ci.point);
    expect(ci.point).toBeLessThanOrEqual(ci.hi);
  });

  it("gives a wider interval for a more variable sample", () => {
    const wide = bootstrapMeanCI(spread, { seed: 1 })!;
    const narrow = bootstrapMeanCI(tight, { seed: 1 })!;
    expect(wide.hi - wide.lo).toBeGreaterThan(narrow.hi - narrow.lo);
  });

  it("returns null below the minimum sample size", () => {
    expect(bootstrapMeanCI([1, 2, 3, 4])).toBeNull();
  });

  it("collapses to a point when the sample has no spread", () => {
    const ci = bootstrapMeanCI([5, 5, 5, 5, 5, 5])!;
    expect(ci.point).toBe(5);
    expect(ci.lo).toBe(5);
    expect(ci.hi).toBe(5);
  });

  it("reports sample size and iterations", () => {
    const ci = bootstrapMeanCI(spread, { iterations: 500 })!;
    expect(ci.n).toBe(spread.length);
    expect(ci.iterations).toBe(500);
    expect(ci.ciPct).toBe(90);
  });
});
