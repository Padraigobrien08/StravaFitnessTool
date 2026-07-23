import { describe, expect, it } from "vitest";
import { buildLimiterProtocol } from "../limiterProtocols";
import { evaluateVolumeTrendAdherence } from "@/lib/recommendation-outcomes/evaluateVolumeTrend";
import type {
  CapabilityAxis,
  CapabilityAxisKey,
  CapabilityRadar,
} from "@/lib/analytics/capabilityRadar";
import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { RunActivity } from "@/lib/strava/types";
import type { LoggedRecommendation } from "@/lib/recommendation-outcomes/types";

function axis(key: CapabilityAxisKey, score: number, isLimiter = false): CapabilityAxis {
  return {
    key,
    label: key,
    score,
    basis: "test",
    demandImportance: 1,
    isLimiter,
    confidence: "medium",
    evidence: "test evidence",
  };
}

function radar(limiterKey: CapabilityAxisKey | null, available = true): CapabilityRadar {
  const axes = [axis("aerobic_base", 60), axis("threshold", 55), axis("top_end_speed", 40)];
  const biggestLimiter = limiterKey ? axis(limiterKey, 40, true) : null;
  return {
    available,
    axes,
    goalDistanceLabel: "5K",
    biggestLimiter,
    interpretation: "test",
    evidence: [],
    limitations: [],
  };
}

/** Minimal analytics with just enough for buildRaceForecastInput to project. */
function analyticsFor(r: CapabilityRadar, forecastReady: boolean): DashboardInsights {
  const efforts = forecastReady
    ? [
        {
          distanceKm: 3,
          timeSec: 660,
          runId: "a",
          runName: "3K",
          date: "2025-05-01",
          source: "Best effort",
        },
        {
          distanceKm: 5,
          timeSec: 1150,
          runId: "b",
          runName: "5K",
          date: "2025-05-10",
          source: "Best effort",
        },
        {
          distanceKm: 8,
          timeSec: 1950,
          runId: "c",
          runName: "8K",
          date: "2025-05-20",
          source: "Full run",
        },
        {
          distanceKm: 10,
          timeSec: 2500,
          runId: "d",
          runName: "10K",
          date: "2025-05-25",
          source: "Full run",
        },
      ]
    : [];
  return {
    capabilityRadar: r,
    racePredictionAnalysis: { efforts },
    trainingBlocks: forecastReady
      ? [
          { weekStart: "2025-05-01", label: "Blk", distanceKm: 120, runCount: 5, longestRunKm: 14 },
          { weekStart: "2025-05-29", label: "Blk", distanceKm: 130, runCount: 5, longestRunKm: 16 },
        ]
      : [],
    fatigue: { freshness: 60, tsb: 0, ctl: 45, atl: 45 },
    raceReadiness: null,
    intensityAdvice: { hardRunsLast14d: 2, currentEasyPct: 70 },
    efficiencySummary: { latest: 2, trend: "stable" },
  } as unknown as DashboardInsights;
}

const goal5k: RaceGoal = { distance: "5k", date: "2025-12-01", targetTimeSec: 1140 };

describe("buildLimiterProtocol — mapping", () => {
  it("maps each limiter axis to its protocol (goal-null early return keeps the mapping)", () => {
    const cases: [CapabilityAxisKey, string][] = [
      ["top_end_speed", "VO₂ / speed block"],
      ["threshold", "Threshold block"],
      ["aerobic_base", "Aerobic base block"],
      ["durability", "Long-run / durability block"],
      ["economy", "Economy block"],
      ["consistency", "Consistency block"],
    ];
    for (const [key, title] of cases) {
      const r = buildLimiterProtocol({ analytics: analyticsFor(radar(key), false), goal: null });
      expect(r.available).toBe(true);
      expect(r.limiter?.key).toBe(key);
      expect(r.protocol?.title).toBe(title);
      // No forecast input (goal null) → no projection, honest limitation.
      expect(r.projectedGainSec).toBeNull();
      expect(r.limitations.length).toBeGreaterThan(0);
    }
  });
});

describe("buildLimiterProtocol — availability", () => {
  it("is unavailable when the radar isn't available", () => {
    const r = buildLimiterProtocol({
      analytics: analyticsFor(radar(null, false), false),
      goal: goal5k,
    });
    expect(r.available).toBe(false);
    expect(r.protocol).toBeNull();
  });

  it("is unavailable when no limiter is flagged", () => {
    const r = buildLimiterProtocol({
      analytics: analyticsFor(radar(null, true), false),
      goal: goal5k,
    });
    expect(r.available).toBe(false);
  });
});

describe("buildLimiterProtocol — projection", () => {
  it("derives projected gain and probability from the mapped goal scenario", () => {
    const runs: RunActivity[] = []; // efforts come from analytics.racePredictionAnalysis
    const r = buildLimiterProtocol({
      analytics: analyticsFor(radar("top_end_speed"), true),
      goal: goal5k,
      runs,
    });
    expect(r.available).toBe(true);
    expect(r.protocol?.title).toBe("VO₂ / speed block");
    expect(r.baselineTimeLabel).not.toBeNull();
    expect(r.projectedTimeLabel).not.toBeNull();
    expect(typeof r.projectedGainSec).toBe("number");
    expect(r.projectedGainSec!).toBeGreaterThanOrEqual(0);
    // Target time is set → probability should be present.
    expect(r.probabilityPct).not.toBeNull();
    expect(r.targetWeeklyKm).not.toBeNull();
  });
});

describe("limiter_protocol adherence routing", () => {
  it("is judged by the strategic volume-trend adherence like goal_scenario", () => {
    const rec: LoggedRecommendation = {
      recommendationId: "limiter_protocol:2025-05-01",
      producer: "limiter_protocol",
      issuedAt: "2025-05-01T00:00:00.000Z",
      targetDate: "2025-05-01",
      kind: "improve_top_end_speed",
      headline: "VO₂ / speed block for top_end_speed",
      distanceKmMin: null,
      distanceKmMax: null,
      targetWeeklyKm: 40,
    };
    // Four weeks of ~40 km/wk since issuance → on target → followed.
    const runs: RunActivity[] = [];
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 4; d++) {
        const day = 2 + w * 7 + d;
        runs.push({
          id: `r${w}-${d}`,
          name: "Run",
          date: `2025-05-${String(day).padStart(2, "0")}T09:00:00.000Z`,
          distanceM: 10000,
          movingSec: 3000,
          elapsedSec: 3000,
          avgSpeedMps: null,
          maxSpeedMps: null,
          avgHr: 150,
          maxHr: 165,
          elevationGainM: 20,
          calories: null,
          relativeEffort: null,
          trainingLoad: null,
          gradeAdjustedPaceSecPerKm: null,
          avgCadence: null,
          totalSteps: null,
          weatherTempC: null,
        });
      }
    }
    const res = evaluateVolumeTrendAdherence(rec, runs, "2025-06-05");
    expect(["followed", "partial"]).toContain(res.adherence);
  });
});
