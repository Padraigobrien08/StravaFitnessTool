import { describe, expect, it } from "vitest";
import { inferLikelyDrivers, buildAttributionNarrative } from "../index";
import { lowData, raceWeekAthlete } from "@/lib/coaching-context/__tests__/fixtures";

describe("driver attribution", () => {
  it("uses calibrated language in summary", () => {
    const exp = inferLikelyDrivers(lowData.analytics, "readiness");
    const narrative = buildAttributionNarrative(exp);
    expect(narrative.length).toBeGreaterThan(10);
    expect(narrative.toLowerCase()).not.toMatch(/guarantee|diagnos/);
  });

  it("attributes fatigue to load drivers", () => {
    const f = raceWeekAthlete();
    f.analytics.fatigue.tsb = -18;
    f.analytics.intensityAdvice.hardRunsLast14d = 5;
    const exp = inferLikelyDrivers(f.analytics, "fatigue");
    expect(exp.likelyDrivers.length).toBeGreaterThan(0);
    expect(exp.summary.toLowerCase()).toMatch(/appear|freshness|tsb|load/i);
  });
});
