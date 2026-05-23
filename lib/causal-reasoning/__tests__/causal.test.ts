import { describe, expect, it } from "vitest";
import { inferLikelyCauses, buildCausalNarrative } from "../index";
import { lowData, raceWeekAthlete } from "@/lib/coaching-context/__tests__/fixtures";

describe("causal reasoning", () => {
  it("uses calibrated language in summary", () => {
    const exp = inferLikelyCauses(lowData.analytics, "readiness");
    const narrative = buildCausalNarrative(exp);
    expect(narrative.length).toBeGreaterThan(10);
    expect(narrative.toLowerCase()).not.toMatch(/guarantee|diagnos/);
  });

  it("attributes fatigue to load drivers", () => {
    const f = raceWeekAthlete();
    f.analytics.fatigue.tsb = -18;
    f.analytics.intensityAdvice.hardRunsLast14d = 5;
    const exp = inferLikelyCauses(f.analytics, "fatigue");
    expect(exp.likelyDrivers.length).toBeGreaterThan(0);
    expect(exp.summary.toLowerCase()).toMatch(/appear|freshness|tsb|load/i);
  });
});
