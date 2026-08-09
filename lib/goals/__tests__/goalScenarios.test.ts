import { describe, expect, it } from "vitest";
import { computeGoalScenarios, probabilityOfTarget } from "../goalScenarios";
import {
  hmReadyRunnerInput,
  lowDataRunnerInput,
  marathonUnderpreparedInput,
} from "@/lib/forecasting-v2/evaluation/fixtures";
import type { RaceForecastInput } from "@/lib/forecasting-v2/forecastTypes";

const interval = {
  outerLowSec: 6000,
  innerLowSec: 6200,
  mostLikelySec: 6400,
  innerHighSec: 6600,
  outerHighSec: 6800,
};

describe("probabilityOfTarget", () => {
  it("returns ~the anchor percentile when the target sits on an anchor", () => {
    expect(probabilityOfTarget(6400, interval)).toBe(50);
    expect(probabilityOfTarget(6200, interval)).toBe(25);
    expect(probabilityOfTarget(6600, interval)).toBe(75);
  });

  it("interpolates between anchors", () => {
    // Midway between mostLikelySec (6400→50) and innerHighSec (6600→75) → ~62.5
    expect(probabilityOfTarget(6500, interval)).toBeCloseTo(62.5, 0);
  });

  it("rises monotonically with a slower (larger) target time", () => {
    const a = probabilityOfTarget(6100, interval);
    const b = probabilityOfTarget(6400, interval);
    const c = probabilityOfTarget(6700, interval);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("clamps extreme targets to [2, 98]", () => {
    expect(probabilityOfTarget(1000, interval)).toBeGreaterThanOrEqual(2);
    expect(probabilityOfTarget(1000, interval)).toBeLessThan(10);
    expect(probabilityOfTarget(99999, interval)).toBeLessThanOrEqual(98);
    expect(probabilityOfTarget(99999, interval)).toBeGreaterThan(90);
  });
});

describe("computeGoalScenarios", () => {
  it("produces the four-scenario ladder with a target present", () => {
    const r = computeGoalScenarios(hmReadyRunnerInput);
    expect(r.hasTarget).toBe(true);
    expect(r.targetTimeSec).toBe(6480);
    expect(r.scenarios.map((s) => s.id)).toEqual(["maintain", "volume", "quality", "full-block"]);
    for (const s of r.scenarios) {
      expect(s.probabilityPct).not.toBeNull();
      expect(s.probabilityPct!).toBeGreaterThanOrEqual(2);
      expect(s.probabilityPct!).toBeLessThanOrEqual(98);
      expect(s.leverSummary.length).toBeGreaterThan(0);
      expect(s.projectedTimeSec).toBeGreaterThan(0);
    }
  });

  it("the maintain scenario mirrors the baseline projection", () => {
    const r = computeGoalScenarios(hmReadyRunnerInput);
    const maintain = r.scenarios.find((s) => s.id === "maintain")!;
    expect(maintain.projectedTimeSec).toBe(r.baselineTimeSec);
    expect(maintain.probabilityPct).toBe(r.baselineProbabilityPct);
  });

  it("a full training block projects at least as fast as maintaining", () => {
    const r = computeGoalScenarios(hmReadyRunnerInput);
    const maintain = r.scenarios.find((s) => s.id === "maintain")!;
    const full = r.scenarios.find((s) => s.id === "full-block")!;
    // More training should not make the prediction slower.
    expect(full.projectedTimeSec).toBeLessThanOrEqual(maintain.projectedTimeSec);
    // …and therefore should not lower the probability of hitting the target.
    expect(full.probabilityPct!).toBeGreaterThanOrEqual(maintain.probabilityPct!);
  });

  it("reports no target and a prompt when the goal has no target time", () => {
    const noTarget: RaceForecastInput = {
      ...hmReadyRunnerInput,
      goal: { ...hmReadyRunnerInput.goal, targetTimeSec: undefined },
    };
    const r = computeGoalScenarios(noTarget);
    expect(r.hasTarget).toBe(false);
    expect(r.baselineProbabilityPct).toBeNull();
    expect(r.scenarios.every((s) => s.probabilityPct === null)).toBe(true);
    expect(r.recommendation).toMatch(/set a target/i);
    expect(r.limitations.join(" ")).toMatch(/no target/i);
  });

  it("flags low-confidence limitations when evidence is thin", () => {
    const r = computeGoalScenarios(lowDataRunnerInput);
    expect(r.limitations.length).toBeGreaterThan(0);
  });

  it("recommends a stretch-target message when even a full block falls short", () => {
    // An impossibly fast marathon target for an underprepared athlete.
    const stretch: RaceForecastInput = {
      ...marathonUnderpreparedInput,
      goal: { ...marathonUnderpreparedInput.goal, targetTimeSec: 7200 }, // 2:00 marathon
    };
    const r = computeGoalScenarios(stretch);
    expect(r.recommendation).toMatch(/stretch|conservative|later race/i);
  });
});
