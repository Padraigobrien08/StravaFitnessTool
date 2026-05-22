import { describe, expect, it } from "vitest";
import { generateInsights } from "../generate";
import type { DashboardInsights } from "@/lib/analytics";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import { computeTrainingEcosystem } from "@/lib/ecosystem";

const minimalQuality: ImportQualityReport = {
  runCount: 10,
  activityCount: 20,
  fitParsed: 0,
  fitReferenced: 0,
  skippedFit: 0,
  lastImport: new Date().toISOString(),
  sportTypes: ["Run"],
  fieldCoverage: [],
  warnings: [],
  overallConfidence: "medium",
};

const baseAnalytics = {
  summary: {
    runCount: 10,
    totalDistanceKm: 80,
    dateRange: null,
    avgPaceSecPerKm: 360,
    avgHr: 160,
    last7DaysKm: 20,
    last7DaysRuns: 2,
  },
  easyHard: { easy: 2, hard: 8, easyPct: 20 },
  halfMarathonReadiness: {
    score: 45,
    label: "In training",
    longestRunKm: 15,
    longestRunPct: 70,
    fourWeekVolumeKm: 60,
    volumePct: 38,
  },
  goalProgress: null,
  efficiencySummary: { latest: null, trend: null },
  dataConfidence: "medium" as const,
  currentWeek: {
    weekStart: "2025-05-12",
    weekLabel: "May 12 – May 18",
    runCount: 2,
    distanceKm: 20,
    longestRunKm: 12,
    easyCount: 1,
    hardCount: 1,
    avgPaceSecPerKm: 360,
  },
  previousWeek: null,
  weeklyNarrative: {
    weekLabel: "May 12 – May 18",
    paragraphs: ["You trained 2 times this week."],
    bullets: ["2 runs this week"],
    severity: "neutral" as const,
    confidence: "medium" as const,
  },
  consistencyScore: {
    overall: 55,
    label: "Building",
    frequency: 50,
    volumeStability: 60,
    streakWeeks: 2,
    evidence: ["test"],
  },
  intensityAdvice: {
    status: "too_hard" as const,
    easyTargetPct: 80,
    currentEasyPct: 20,
    hardRunsLast14d: 5,
    recommendations: ["Add easy runs"],
    suggestedWeekPlan: [],
  },
  prTimeline: [],
  predictionTimeline: [],
  fatigue: {
    ctl: 100,
    atl: 120,
    tsb: -20,
    freshness: 30,
    label: "Fatigued",
    restDaysSinceLastRun: 1,
    evidence: ["TSB -20"],
    usesProxyLoad: false,
  },
  loadHistory: [],
  efficiencyMoM: {
    currentMonth: null,
    priorMonth: null,
    pctChange: null,
    narrative: null,
    comparableCount: 0,
  },
  raceReadiness: null,
  raceStrategy: null,
  workoutLabels: [],
  workoutTypeMix: [],
  nextWeekPlan: {
    weekStart: "2025-05-19",
    weekLabel: "May 19 – May 25",
    totalKmRange: [35, 42],
    template: "base",
    sessions: [
      {
        type: "easy",
        distanceKmRange: [8, 10],
        description: "Easy aerobic",
      },
    ],
    warnings: ["Not a substitute for a coach or medical advice."],
    rationale: ["Targeting ~40 km."],
  },
  trainingEcosystem: computeTrainingEcosystem(
    {
      runs: [],
      profile: {
        maxHeartRate: 190,
        athleteType: null,
        ftp: null,
        measurementPreference: null,
      },
      goals: [],
      allActivities: [],
      importedAt: new Date().toISOString(),
    },
    [],
    "medium",
    null
  ),
} as DashboardInsights;

describe("generateInsights", () => {
  it("warns on intensity-heavy training", () => {
    const insights = generateInsights(baseAnalytics, minimalQuality);
    const intensity = insights.find((i) => i.id === "intensity-heavy");
    expect(intensity).toBeDefined();
    expect(intensity?.severity).toBe("warning");
    expect(intensity?.recommendation).toContain("easy");
  });

  it("covers all five user questions", () => {
    const insights = generateInsights(baseAnalytics, minimalQuality);
    const questions = new Set(insights.map((i) => i.question));
    expect(questions.has("improving")).toBe(true);
    expect(questions.has("training")).toBe(true);
    expect(questions.has("ready")).toBe(true);
    expect(questions.has("next")).toBe(true);
    expect(questions.has("changed")).toBe(true);
  });
});
