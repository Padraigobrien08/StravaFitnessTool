import { describe, it, expect } from "vitest";
import {
  computeOutcomeCalibration,
  type EfficiencySample,
  type OutcomeSample,
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

const sample = (
  date: string,
  o: { eff?: number; exec?: number; drift?: number; km?: number },
): OutcomeSample => ({
  date,
  efficiency: o.eff,
  executionScore: o.exec,
  hrDriftPct: o.drift,
  distanceKm: o.km,
});

describe("computeOutcomeCalibration — execution grade", () => {
  it("uses session execution grade to judge outcomes (higher = better)", () => {
    // heavy → low execution (session went badly); fresh → high execution.
    const reports = PREDICTIVE.reports;
    const samples = [
      sample("2026-03-01", { exec: 40 }),
      sample("2026-03-02", { exec: 45 }),
      sample("2026-03-03", { exec: 50 }),
      sample("2026-03-04", { exec: 85 }),
      sample("2026-03-05", { exec: 80 }),
      sample("2026-03-06", { exec: 75 }),
    ];
    const c = computeOutcomeCalibration(reports, samples);
    expect(c.reliability).toBeGreaterThan(0.5);
    expect(c.heavyDelta).toBeLessThan(DEFAULT_FEEL_CALIBRATION.heavyDelta);
    expect(c.basis).toContain("session execution");
  });

  it("prefers the execution verdict over efficiency when both are present", () => {
    // Execution says confirmed; efficiency alone would say contradicted.
    const reports = PREDICTIVE.reports;
    const samples = [
      sample("2026-03-01", { exec: 40, eff: 1.6 }), // heavy: exec worse ✓ / eff better ✗
      sample("2026-03-02", { exec: 45, eff: 1.7 }),
      sample("2026-03-03", { exec: 50, eff: 1.8 }),
      sample("2026-03-04", { exec: 85, eff: 2.5 }), // fresh: exec better ✓ / eff worse ✗
      sample("2026-03-05", { exec: 80, eff: 2.4 }),
      sample("2026-03-06", { exec: 75, eff: 2.3 }),
    ];
    const c = computeOutcomeCalibration(reports, samples);
    // If efficiency had won, reliability would be < 0.5 (all contradicted).
    expect(c.reliability).toBeGreaterThan(0.5);
    expect(c.basis).toContain("session execution");
  });
});

describe("computeOutcomeCalibration — HR-drift & training-response tiers", () => {
  it("uses HR drift when there's no execution grade (higher drift = worse)", () => {
    const samples = [
      sample("2026-03-01", { drift: 8 }), // heavy → high drift ✓
      sample("2026-03-02", { drift: 9 }),
      sample("2026-03-03", { drift: 10 }),
      sample("2026-03-04", { drift: 2 }), // fresh → low drift ✓
      sample("2026-03-05", { drift: 3 }),
      sample("2026-03-06", { drift: 4 }),
    ];
    const c = computeOutcomeCalibration(PREDICTIVE.reports, samples);
    expect(c.reliability).toBeGreaterThan(0.5);
    expect(c.basis).toContain("heart-rate drift");
  });

  it("falls to training-response (volume) when only distance is available", () => {
    const samples = [
      sample("2026-03-01", { km: 3 }), // heavy → trained less ✓
      sample("2026-03-02", { km: 4 }),
      sample("2026-03-03", { km: 5 }),
      sample("2026-03-04", { km: 12 }), // fresh → trained normally ✓
      sample("2026-03-05", { km: 13 }),
      sample("2026-03-06", { km: 14 }),
    ];
    const c = computeOutcomeCalibration(PREDICTIVE.reports, samples);
    expect(c.reliability).toBeGreaterThan(0.5);
    expect(c.basis).toContain("how you trained after");
  });
});
