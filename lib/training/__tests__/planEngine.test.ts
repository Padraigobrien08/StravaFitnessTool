import { describe, expect, it, vi } from "vitest";
import {
  buildNextWeekPlan,
  isRaceInPlanWeek,
  planWeekBounds,
  type PlanContext,
} from "../planEngine";
import { countHardSessions } from "../safety";
import type { FatigueSnapshot } from "@/lib/analytics/fatigue";
import type { IntensityAdvice } from "@/lib/analytics/intensityAdvisor";
import type { ConsistencyScore } from "@/lib/analytics/consistency";
import type { WeekSnapshot } from "@/lib/analytics/week";

const week: WeekSnapshot = {
  weekStart: "2025-05-12",
  weekLabel: "May 12 – May 18",
  runCount: 3,
  distanceKm: 40,
  longestRunKm: 14,
  easyCount: 2,
  hardCount: 1,
  avgPaceSecPerKm: 300,
};

function baseContext(overrides: Partial<PlanContext> = {}): PlanContext {
  const fatigue: FatigueSnapshot = {
    ctl: 80,
    atl: 90,
    tsb: -10,
    freshness: 55,
    label: "Neutral",
    restDaysSinceLastRun: 1,
    evidence: [],
    usesProxyLoad: false,
  };
  const intensityAdvice: IntensityAdvice = {
    status: "balanced",
    easyTargetPct: 80,
    currentEasyPct: 65,
    hardRunsLast14d: 1,
    recommendations: [],
    suggestedWeekPlan: [],
  };
  const consistencyScore: ConsistencyScore = {
    overall: 70,
    label: "Building",
    frequency: 75,
    volumeStability: 60,
    streakWeeks: 4,
    evidence: [],
  };
  return {
    fatigue,
    intensityAdvice,
    consistencyScore,
    raceReadiness: null,
    currentWeek: week,
    previousWeek: { ...week, distanceKm: 45 },
    weeklyVolume: [
      { weekStart: "2025-04-01", label: "Apr 1", distanceKm: 42, runCount: 3 },
      { weekStart: "2025-04-08", label: "Apr 8", distanceKm: 38, runCount: 3 },
      { weekStart: "2025-04-15", label: "Apr 15", distanceKm: 44, runCount: 4 },
      { weekStart: "2025-05-12", label: "May 12", distanceKm: 40, runCount: 3 },
    ],
    easyHardPct: 65,
    runsPerWeekTarget: 3,
    longestRunKm: 16,
    ...overrides,
  };
}

describe("buildNextWeekPlan", () => {
  it("uses recovery template when fatigued", () => {
    const plan = buildNextWeekPlan(
      baseContext({
        fatigue: {
          ...baseContext().fatigue,
          freshness: 30,
          label: "Fatigued",
        },
      })
    );
    expect(plan.template).toBe("recovery");
    expect(countHardSessions(plan)).toBe(0);
    expect(plan.rationale.length).toBeGreaterThan(0);
  });

  it("uses race week plan (not Sat long + Sun recovery) when race is on Sunday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-05-20T12:00:00")); // Tue before Sun May 25
    try {
      const raceDate = "2025-05-25";
      const plan = buildNextWeekPlan(
        baseContext({
          raceReadiness: {
            distance: "hm",
            distanceLabel: "Half marathon",
            daysUntilRace: 5,
            raceDate,
            score: 75,
            label: "Nearly there",
            probabilityBand: "On track",
            longestRunKm: 18,
            longestRunPct: 90,
            fourWeekVolumeKm: 140,
            volumePct: 85,
            gaps: [],
          },
        })
      );
      expect(plan.template).toBe("race_week");
      expect(plan.sessions.some((s) => s.type === "long")).toBe(false);
      const raceSession = plan.sessions.find((s) => s.type === "race");
      expect(raceSession?.day).toBe("Sun");
      expect(plan.sessions.find((s) => s.day === "Sun" && s.type === "recovery")).toBe(
        undefined
      );
      expect(isRaceInPlanWeek(raceDate, plan.weekStart)).toBe(true);
      const bounds = planWeekBounds(raceDate, 5);
      expect(bounds.weekLabel).toContain("May 19");
    } finally {
      vi.useRealTimers();
    }
  });

  it("plans the week containing the race, not the calendar week after", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-05-19T12:00:00")); // Mon, race Sun May 25
    try {
      const raceDate = "2025-05-25";
      const bounds = planWeekBounds(raceDate, 6);
      expect(bounds.weekStart).toBe("2025-05-19");
      expect(isRaceInPlanWeek(raceDate, bounds.weekStart)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tapers volume when race is 8–14 days out and not in the planned taper week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-05-01T12:00:00"));
    try {
      const plan = buildNextWeekPlan(
        baseContext({
          raceReadiness: {
            distance: "hm",
            distanceLabel: "Half marathon",
            daysUntilRace: 12,
            raceDate: "2025-05-13", // Tue — plan week is May 12–18 containing race
            score: 75,
            label: "Nearly there",
            probabilityBand: "On track",
            longestRunKm: 18,
            longestRunPct: 90,
            fourWeekVolumeKm: 140,
            volumePct: 85,
            gaps: [],
          },
        })
      );
      // Race falls in plan week → race_week, not generic taper
      expect(plan.template).toBe("race_week");
      expect(plan.totalKmRange[1]).toBeLessThan(45);
    } finally {
      vi.useRealTimers();
    }
  });

  it("avoids intervals when intensity too hard", () => {
    const plan = buildNextWeekPlan(
      baseContext({
        intensityAdvice: {
          ...baseContext().intensityAdvice,
          status: "too_hard",
          currentEasyPct: 15,
          hardRunsLast14d: 4,
        },
      })
    );
    expect(plan.template).toBe("easy_reset");
    expect(countHardSessions(plan)).toBe(0);
  });

  it("includes medical disclaimer in warnings", () => {
    const plan = buildNextWeekPlan(baseContext());
    expect(
      plan.warnings.some((w) => w.includes("Not a substitute"))
    ).toBe(true);
  });
});
