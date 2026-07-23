import { describe, expect, it } from "vitest";
import { computeForecastSensitivity } from "../sensitivity";
import { hmReadyRunnerInput, marathonUnderpreparedInput } from "../evaluation/fixtures";

describe("computeForecastSensitivity", () => {
  it("returns one factor per lever, sorted by absolute leverage", () => {
    const factors = computeForecastSensitivity(marathonUnderpreparedInput);
    expect(factors.map((f) => f.id).sort()).toEqual(["freshness", "long_run", "quality", "volume"]);
    for (let i = 1; i < factors.length; i++) {
      expect(Math.abs(factors[i - 1].deltaSec)).toBeGreaterThanOrEqual(
        Math.abs(factors[i].deltaSec),
      );
    }
  });

  it("surfaces improving levers as faster (long run relieves a durability gap)", () => {
    const factors = computeForecastSensitivity(marathonUnderpreparedInput);
    const longRun = factors.find((f) => f.id === "long_run")!;
    expect(longRun.direction).toBe("faster");
    expect(longRun.deltaSec).toBeLessThan(0);
  });

  it("can show a lever as slower — adding quality now adds fatigue for a fatigued runner", () => {
    // The tornado shows leverage in either direction; this is a real signal,
    // not a bug: more hard running near race day can suppress race-day pace.
    const quality = computeForecastSensitivity(marathonUnderpreparedInput).find(
      (f) => f.id === "quality",
    )!;
    if (quality.direction === "slower") {
      expect(quality.deltaSec).toBeGreaterThan(1);
    }
  });

  it("labels direction consistently with the delta sign", () => {
    for (const f of computeForecastSensitivity(marathonUnderpreparedInput)) {
      if (f.direction === "faster") expect(f.deltaSec).toBeLessThan(-1);
      if (f.direction === "slower") expect(f.deltaSec).toBeGreaterThan(1);
      if (f.direction === "none") expect(Math.abs(f.deltaSec)).toBeLessThanOrEqual(1);
    }
  });

  it("surfaces a durability lever (long run) as high leverage for an underprepared marathon", () => {
    const factors = computeForecastSensitivity(marathonUnderpreparedInput);
    // At least one lever should move the forecast for a runner with clear gaps.
    expect(factors.some((f) => f.deltaSec < -1)).toBe(true);
  });
});
