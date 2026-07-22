import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { AthleteIntelligenceBundle } from "@/lib/intelligence/types";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import { computeInsights } from "@/lib/analytics";
import { generateInsights } from "@/lib/insights/generate";
import type { RunWorkoutLabel } from "@/lib/analytics/workoutType";

const baseRun: Omit<RunActivity, "id" | "date" | "name" | "distanceM"> = {
  elapsedSec: 3600,
  movingSec: 3580,
  avgSpeedMps: 3.2,
  maxSpeedMps: 4,
  avgHr: 155,
  maxHr: 175,
  elevationGainM: 50,
  calories: 500,
  relativeEffort: 120,
  trainingLoad: 400,
  gradeAdjustedPaceSecPerKm: null,
  avgCadence: 78,
  totalSteps: null,
  weatherTempC: null,
};

export function makeRun(
  id: string,
  date: string,
  distanceKm: number,
  overrides: Partial<RunActivity> = {},
): RunActivity {
  return {
    ...baseRun,
    id,
    date,
    name: `Run ${id}`,
    distanceM: distanceKm * 1000,
    ...overrides,
  };
}

export function makePaceStream(
  length: number,
  startPace: number,
  endPace: number,
): FitRunDetail["paceStream"] {
  const stream: FitRunDetail["paceStream"] = [];
  for (let i = 0; i < length; i++) {
    const t = i * 60;
    const pace = startPace + ((endPace - startPace) * i) / Math.max(1, length - 1);
    stream.push({ elapsedSec: t, paceSecPerKm: pace });
  }
  return stream;
}

export function emptyFit(activityId: string): FitRunDetail {
  return {
    activityId,
    bestEfforts: [],
    laps: [],
    hrStream: [],
    paceStream: [],
    cadenceStream: [],
    gpsStream: [],
    hrDriftPct: null,
    avgCadence: null,
  };
}

const defaultQuality: ImportQualityReport = {
  runCount: 10,
  activityCount: 10,
  fitParsed: 2,
  fitReferenced: 2,
  skippedFit: 0,
  lastImport: new Date().toISOString(),
  sportTypes: ["Run"],
  fieldCoverage: [
    { label: "Heart rate", count: 10, total: 10, level: "high" },
    { label: "GPS", count: 10, total: 10, level: "high" },
  ],
  warnings: [],
  overallConfidence: "medium",
};

export function buildTestBundle(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = [],
  labels?: RunWorkoutLabel[],
): AthleteIntelligenceBundle {
  const importData = {
    runs,
    profile: {
      maxHeartRate: null,
      athleteType: null,
      ftp: null,
      measurementPreference: null,
    },
    goals: [],
    allActivities: [],
    importedAt: new Date().toISOString(),
    fitRunIds: [],
  };
  const quality = { ...defaultQuality, runCount: runs.length };
  const analytics = computeInsights(importData, fitDetails, 3, null);
  if (labels) {
    analytics.workoutLabels = labels;
  }
  const insights = generateInsights(analytics, quality);
  return {
    analytics,
    insights,
    quality,
    recentRuns: [],
    runs,
    fitDetails,
  };
}
