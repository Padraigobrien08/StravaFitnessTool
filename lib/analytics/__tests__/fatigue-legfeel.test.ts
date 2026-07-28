import { describe, it, expect } from "vitest";
import { freshnessFromTsb } from "@/lib/analytics/fatigue";

describe("freshnessFromTsb — leg-feel subjective nudge", () => {
  it("is a no-op when legFeel is absent (byte-identical to the base path)", () => {
    for (const tsb of [-30, -10, 0, 8, 25]) {
      expect(freshnessFromTsb(tsb, 0, undefined)).toEqual(freshnessFromTsb(tsb, 0));
    }
  });

  it("normal is a no-op", () => {
    expect(freshnessFromTsb(0, 0, "normal")).toEqual(freshnessFromTsb(0, 0));
  });

  it("heavy lowers freshness, capped at 12 points", () => {
    const base = freshnessFromTsb(5, 0);
    const heavy = freshnessFromTsb(5, 0, "heavy");
    expect(heavy.freshness).toBeLessThan(base.freshness);
    expect(base.freshness - heavy.freshness).toBeLessThanOrEqual(12);
  });

  it("fresh raises freshness but only a little (asymmetric, safety-first)", () => {
    const base = freshnessFromTsb(0, 0);
    const fresh = freshnessFromTsb(0, 0, "fresh");
    expect(fresh.freshness).toBeGreaterThanOrEqual(base.freshness);
    expect(fresh.freshness - base.freshness).toBeLessThanOrEqual(5);
  });

  it("heavy can downgrade a Fresh label", () => {
    expect(freshnessFromTsb(30, 0).label).toBe("Fresh"); // tsb > 10
    expect(freshnessFromTsb(30, 0, "heavy").label).not.toBe("Fresh");
  });

  it("fresh never upgrades the label (can't unlock a hard day it wasn't given)", () => {
    const base = freshnessFromTsb(0, 0); // Neutral
    expect(freshnessFromTsb(0, 0, "fresh").label).toBe(base.label);
  });

  it("clamps to [0, 100]", () => {
    expect(freshnessFromTsb(-40, 0, "heavy").freshness).toBeGreaterThanOrEqual(0);
    expect(freshnessFromTsb(40, 3, "fresh").freshness).toBeLessThanOrEqual(100);
  });
});
