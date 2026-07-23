import { describe, expect, it } from "vitest";
import { buildRaceForecastV2 } from "../forecastEngine";
import {
  hmReadyRunnerInput,
  marathonUnderpreparedInput,
  lowDataRunnerInput,
} from "../evaluation/fixtures";

describe("forecast derivation waterfall", () => {
  it("starts at the capability base and ends at the most-likely time", () => {
    const f = buildRaceForecastV2(hmReadyRunnerInput);
    expect(f.derivation.length).toBeGreaterThanOrEqual(4);
    expect(f.derivation[0].key).toBe("capability");
    expect(f.derivation[0].cumulativeSec).toBe(f.capabilityBaseTimeSec);
    expect(f.derivation[f.derivation.length - 1].cumulativeSec).toBe(f.mostLikelyTimeSec);
  });

  it("step deltas reconcile exactly to (most-likely − base)", () => {
    for (const input of [hmReadyRunnerInput, marathonUnderpreparedInput, lowDataRunnerInput]) {
      const f = buildRaceForecastV2(input);
      const sumDeltas = f.derivation.reduce((s, step) => s + step.deltaSec, 0);
      expect(sumDeltas).toBe(f.mostLikelyTimeSec - f.capabilityBaseTimeSec);
    }
  });

  it("cumulatives are consistent with the per-step deltas", () => {
    const f = buildRaceForecastV2(hmReadyRunnerInput);
    for (let i = 1; i < f.derivation.length; i++) {
      expect(f.derivation[i].cumulativeSec).toBe(
        f.derivation[i - 1].cumulativeSec + f.derivation[i].deltaSec,
      );
    }
  });

  it("carries the expected step keys and multipliers", () => {
    const f = buildRaceForecastV2(marathonUnderpreparedInput);
    const keys = f.derivation.map((s) => s.key);
    expect(keys.slice(0, 4)).toEqual(["capability", "durability", "specificity", "freshness"]);
    const dur = f.derivation.find((s) => s.key === "durability")!;
    expect(typeof dur.factor).toBe("number");
    // An underprepared marathon should have durability slow the forecast (factor >= 1).
    expect(dur.factor!).toBeGreaterThanOrEqual(1);
  });
});

describe("confidence decomposition (G4)", () => {
  it("attributes the interval width to base + each driver (reconciles)", () => {
    for (const input of [hmReadyRunnerInput, marathonUnderpreparedInput, lowDataRunnerInput]) {
      const f = buildRaceForecastV2(input);
      const summed =
        f.uncertaintyBaseWidthSec + f.uncertaintyDrivers.reduce((s, d) => s + d.widthSec, 0);
      // Rounding per component can drift by at most 1s each.
      expect(Math.abs(summed - f.uncertaintyWidthSec)).toBeLessThanOrEqual(
        f.uncertaintyDrivers.length + 1,
      );
    }
  });

  it("gives every uncertainty driver a positive width contribution", () => {
    const f = buildRaceForecastV2(lowDataRunnerInput);
    for (const d of f.uncertaintyDrivers) {
      expect(d.widthSec).toBeGreaterThan(0);
    }
  });
});
