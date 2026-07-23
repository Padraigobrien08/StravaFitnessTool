import { describe, expect, it } from "vitest";
import {
  computeCapabilityRadar,
  percentileVsOwnHistory,
  type CapabilityRadarInputs,
} from "../capabilityRadar";
import type { AthletePhysiology } from "../physiology";
import type { ConsistencyScore } from "../consistency";
import type { EfficiencyPoint } from "../efficiency";
import type { FitnessIndexPoint } from "../trainingLoad";
import type { PredictionTimelinePoint } from "../progression";
import type { RaceGoal } from "../readiness";

function unavailable() {
  return {
    available: false as const,
    confidence: "low" as const,
    interpretation: "",
    evidence: [],
    limitations: [],
  };
}

function makePhysiology(opts: { durabilityScore?: number | null } = {}): AthletePhysiology {
  const durabilityScore = opts.durabilityScore ?? null;
  return {
    criticalSpeed: {
      ...unavailable(),
      csMetersPerSec: null,
      csPaceSecPerKm: null,
      dPrimeMeters: null,
      rSquared: null,
      n: 0,
    },
    fatigueResistance: {
      ...unavailable(),
      exponent: null,
      referenceExponent: 1.06,
      extraFadePerDoublingPct: null,
      rSquared: null,
      n: 0,
      trend: null,
      trendDetail: null,
    },
    durability:
      durabilityScore != null
        ? {
            available: true,
            score: durabilityScore,
            label: durabilityScore >= 72 ? "strong" : durabilityScore < 48 ? "weak" : "moderate",
            decouplingMedianPct: 3,
            lateFadeMedianPct: 2,
            trend: "stable",
            sampleSize: 6,
            confidence: "high",
            interpretation: `Durability ${durabilityScore}/100.`,
            evidence: [],
            limitations: [],
          }
        : {
            ...unavailable(),
            score: null,
            label: null,
            decouplingMedianPct: null,
            lateFadeMedianPct: null,
            trend: null,
            sampleSize: 0,
          },
    thresholdEconomy: {
      ...unavailable(),
      ltPaceSecPerKm: null,
      ltHr: null,
      ltPctMaxHr: null,
      thresholdSampleSize: 0,
      economyIndex: null,
      economyTrend: null,
      economySampleSize: 0,
    },
    conditionNormalization: {
      ...unavailable(),
      referenceTempC: 15,
      tempCoveragePct: 0,
      hotRunCount: 0,
      normalizedEfficiencyTrend: null,
      example: null,
    },
  };
}

function consistency(overall: number): ConsistencyScore {
  return {
    overall,
    label: overall >= 70 ? "Steady" : "Building",
    frequency: 3,
    volumeStability: 70,
    streakWeeks: 8,
    evidence: ["8-week streak"],
  };
}

function effPoints(values: number[]): EfficiencyPoint[] {
  return values.map((efficiency, i) => ({
    date: `2025-0${(i % 9) + 1}-01`,
    label: `p${i}`,
    runName: `Run ${i}`,
    efficiency,
    avgHr: 150,
    paceSecPerKm: efficiency * 150,
  }));
}

function ctlPoints(values: number[]): FitnessIndexPoint[] {
  return values.map((ctl, i) => ({ weekStart: `2025-0${(i % 9) + 1}-01`, label: `w${i}`, ctl }));
}

function predPoints(fiveK: number[]): PredictionTimelinePoint[] {
  return fiveK.map((s, i) => ({
    weekStart: `2025-0${(i % 9) + 1}-01`,
    label: `w${i}`,
    consensus5kSec: s,
    consensus10kSec: s * 2.08,
    consensusHmSec: s * 4.6,
  }));
}

function baseInputs(overrides: Partial<CapabilityRadarInputs> = {}): CapabilityRadarInputs {
  return {
    physiology: makePhysiology({ durabilityScore: 60 }),
    consistencyScore: consistency(75),
    efficiencyTrend: effPoints([2.1, 2.05, 2.0, 1.98, 1.95, 1.93]),
    fitnessIndex: ctlPoints([40, 45, 50, 55, 60, 65]),
    predictionTimeline: predPoints([1300, 1290, 1280, 1275, 1270, 1265]),
    ...overrides,
  };
}

const goal5k: RaceGoal = { distance: "5k", date: "2025-12-01" };

describe("percentileVsOwnHistory", () => {
  const series = [10, 20, 30, 40, 50];
  it("scores a top value near 100 and a bottom value near 0 (higher is better)", () => {
    expect(percentileVsOwnHistory(series, 50, true)!).toBeGreaterThanOrEqual(80);
    expect(percentileVsOwnHistory(series, 10, true)!).toBeLessThanOrEqual(20);
  });
  it("scores the median near 50", () => {
    expect(percentileVsOwnHistory(series, 30, true)!).toBe(50);
  });
  it("inverts when lower is better", () => {
    // Fastest (lowest) should score highest when higherIsBetter=false.
    expect(percentileVsOwnHistory(series, 10, false)!).toBeGreaterThanOrEqual(80);
  });
  it("returns null with fewer than 4 points", () => {
    expect(percentileVsOwnHistory([1, 2, 3], 2, true)).toBeNull();
  });
});

describe("computeCapabilityRadar", () => {
  it("builds axes and passes durability/consistency through natively", () => {
    const r = computeCapabilityRadar(baseInputs(), goal5k);
    expect(r.available).toBe(true);
    expect(r.axes.length).toBeGreaterThanOrEqual(5);
    expect(r.axes.find((a) => a.key === "durability")!.score).toBe(60);
    expect(r.axes.find((a) => a.key === "consistency")!.score).toBe(75);
    // With a goal, every axis carries a demand importance.
    expect(r.axes.every((a) => a.demandImportance != null)).toBe(true);
    expect(r.goalDistanceLabel).toBe("5K");
  });

  it("flags the weakest axis that matters for the race as the limiter", () => {
    // Weak top-end speed (recent 5K much slower than history) on a 5K goal,
    // where top-end has demand importance 1.0 → should win as limiter.
    const inputs = baseInputs({
      predictionTimeline: predPoints([1200, 1205, 1210, 1215, 1220, 1300]), // recent = slowest
    });
    const r = computeCapabilityRadar(inputs, goal5k);
    expect(r.biggestLimiter).not.toBeNull();
    expect(r.biggestLimiter!.key).toBe("top_end_speed");
    expect(r.axes.find((a) => a.key === "top_end_speed")!.isLimiter).toBe(true);
  });

  it("omits demand profile and limiter when no goal is set", () => {
    const r = computeCapabilityRadar(baseInputs(), null);
    expect(r.available).toBe(true);
    expect(r.biggestLimiter).toBeNull();
    expect(r.axes.every((a) => a.demandImportance === null)).toBe(true);
    expect(r.limitations.some((l) => /no race goal/i.test(l))).toBe(true);
  });

  it("is unavailable when fewer than three axes can be scored", () => {
    const thin: CapabilityRadarInputs = {
      physiology: makePhysiology({ durabilityScore: null }),
      consistencyScore: consistency(50),
      efficiencyTrend: [],
      fitnessIndex: [],
      predictionTimeline: [],
    };
    const r = computeCapabilityRadar(thin, goal5k);
    expect(r.available).toBe(false);
    expect(r.limitations.length).toBeGreaterThan(0);
  });
});
