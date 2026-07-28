import { describe, it, expect } from "vitest";
import {
  computeOutcomeCalibration,
  type EfficiencySample,
} from "@/lib/wellness/outcomeCalibration";
import { DEFAULT_FEEL_CALIBRATION, type FeelHistoryPoint } from "@/lib/wellness/calibration";

const feel = (date: string, legs: FeelHistoryPoint["legs"]): FeelHistoryPoint => ({ date, legs });
const eff = (date: string, efficiency: number): EfficiencySample => ({ date, efficiency });

// Efficiency: LOWER = better. A same-day sample per report keeps the window trivial.
// Predictive athlete: heavy → ran worse (high), fresh → ran better (low).
const PREDICTIVE = {
  reports: [
    feel("2026-03-01", "heavy"),
    feel("2026-03-02", "heavy"),
    feel("2026-03-03", "heavy"),
    feel("2026-03-04", "fresh"),
    feel("2026-03-05", "fresh"),
    feel("2026-03-06", "fresh"),
  ],
  eff: [
    eff("2026-03-01", 2.5),
    eff("2026-03-02", 2.4),
    eff("2026-03-03", 2.3),
    eff("2026-03-04", 1.6),
    eff("2026-03-05", 1.7),
    eff("2026-03-06", 1.8),
  ],
};

describe("computeOutcomeCalibration", () => {
  it("falls back without a stable efficiency baseline", () => {
    const fb = { ...DEFAULT_FEEL_CALIBRATION, basis: "P3 fallback" };
    expect(computeOutcomeCalibration(PREDICTIVE.reports, PREDICTIVE.eff.slice(0, 2), fb)).toEqual(
      fb,
    );
  });

  it("falls back below the pair gate", () => {
    const fb = { ...DEFAULT_FEEL_CALIBRATION, basis: "P3 fallback" };
    const c = computeOutcomeCalibration([feel("2026-03-01", "heavy")], PREDICTIVE.eff, fb);
    expect(c).toEqual(fb);
  });

  it("amplifies when reports predict how the athlete actually ran", () => {
    const c = computeOutcomeCalibration(PREDICTIVE.reports, PREDICTIVE.eff);
    expect(c.reliability).toBeGreaterThan(0.5);
    expect(c.heavyDelta).toBeLessThan(DEFAULT_FEEL_CALIBRATION.heavyDelta); // stronger
    expect(c.freshDelta).toBeGreaterThan(DEFAULT_FEEL_CALIBRATION.freshDelta);
    expect(c.sampleCount).toBe(6);
  });

  it("dampens (bidirectional) when reports are counter-predictive", () => {
    // Swap the efficiency outcomes so every report is contradicted.
    const flipped: EfficiencySample[] = [
      eff("2026-03-01", 1.6),
      eff("2026-03-02", 1.7),
      eff("2026-03-03", 1.8),
      eff("2026-03-04", 2.5),
      eff("2026-03-05", 2.4),
      eff("2026-03-06", 2.3),
    ];
    const c = computeOutcomeCalibration(PREDICTIVE.reports, flipped);
    expect(c.reliability).toBeLessThan(0.5);
    expect(c.heavyDelta).toBeGreaterThan(DEFAULT_FEEL_CALIBRATION.heavyDelta); // weaker
    expect(c.freshDelta).toBeLessThan(DEFAULT_FEEL_CALIBRATION.freshDelta);
  });

  it("stays within the caps and never weakens 'heavy' past the safety floor", () => {
    const c = computeOutcomeCalibration(PREDICTIVE.reports, PREDICTIVE.eff);
    expect(c.heavyDelta).toBeGreaterThanOrEqual(-18);
    expect(c.heavyDelta).toBeLessThanOrEqual(-6);
    expect(c.freshDelta).toBeGreaterThanOrEqual(3);
    expect(c.freshDelta).toBeLessThanOrEqual(8);
  });
});
