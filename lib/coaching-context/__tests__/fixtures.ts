import { addDays, format, subDays } from "date-fns";
import type { StravaImport } from "@/lib/strava/types";
import type { RunActivity } from "@/lib/strava/types";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { computeInsights } from "@/lib/analytics";

const profile = {
  maxHeartRate: 185,
  athleteType: "runner",
  ftp: null,
  measurementPreference: "meters",
};

export function mkRun(
  daysAgo: number,
  opts?: {
    distanceM?: number;
    movingSec?: number;
    avgHr?: number | null;
    name?: string;
    id?: string;
  },
): RunActivity {
  const date = format(subDays(new Date(), daysAgo), "yyyy-MM-dd");
  const movingSec = opts?.movingSec ?? 3600;
  return {
    id: opts?.id ?? `run-${daysAgo}`,
    name: opts?.name ?? `Run ${daysAgo}d ago`,
    date,
    distanceM: opts?.distanceM ?? 10000,
    movingSec,
    elapsedSec: movingSec + 120,
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr: opts?.avgHr === undefined ? 150 : opts.avgHr,
    maxHr: 175,
    elevationGainM: 40,
    calories: null,
    relativeEffort: null,
    trainingLoad: 45,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  };
}

export function mkImport(
  runs: RunActivity[],
  allActivities?: StravaImport["allActivities"],
): StravaImport {
  return {
    runs,
    profile,
    goals: [],
    allActivities:
      allActivities ??
      runs.map((r) => ({
        id: r.id,
        date: r.date,
        name: r.name,
        type: "Run",
        distanceM: r.distanceM,
        elapsedSec: r.elapsedSec,
        movingSec: r.movingSec,
        avgHr: r.avgHr,
        maxHr: r.maxHr,
      })),
    importedAt: new Date().toISOString(),
    fitRunIds: [],
  };
}

export function insightsFrom(
  runs: RunActivity[],
  goal: RaceGoal | null = null,
  maxWeeklyKm?: number,
) {
  const data = mkImport(runs);
  const analytics = computeInsights(data, [], 3, goal, maxWeeklyKm);
  const quality = assessImportQuality(data);
  return { analytics, quality, runs, data };
}

/** Sparse history, no HR */
export const lowData = insightsFrom(
  [mkRun(3, { avgHr: null }), mkRun(10, { avgHr: null, distanceM: 5000 })],
  null,
);

/** Race in 5 days with taper-like volume drop */
export function raceWeekAthlete() {
  const goal: RaceGoal = {
    distance: "hm",
    date: format(addDays(new Date(), 5), "yyyy-MM-dd"),
    targetTimeSec: 7200,
  };
  const runs = [
    ...Array.from({ length: 3 }, (_, i) => mkRun(14 + i * 2, { distanceM: 12000, name: "Base" })),
    mkRun(7, { distanceM: 8000, movingSec: 2400 }),
    mkRun(2, { distanceM: 5000, movingSec: 1500, name: "Shakeout" }),
  ];
  return insightsFrom(runs, goal);
}

/** Runs + synthetic non-run via allActivities */
export function hybridAthlete() {
  const runs = Array.from({ length: 10 }, (_, i) => mkRun(i * 2, { distanceM: 8000 + i * 500 }));
  const data = mkImport(runs, [
    ...runs.map((r) => ({
      id: r.id,
      date: r.date,
      name: r.name,
      type: "Run",
      distanceM: r.distanceM,
      elapsedSec: r.elapsedSec,
      movingSec: r.movingSec,
    })),
    {
      id: "bike-1",
      date: format(subDays(new Date(), 1), "yyyy-MM-dd"),
      name: "Ride",
      type: "Ride",
      distanceM: 40000,
      elapsedSec: 5400,
      movingSec: 5200,
    },
    {
      id: "wt-1",
      date: format(subDays(new Date(), 2), "yyyy-MM-dd"),
      name: "Gym",
      type: "WeightTraining",
      distanceM: 0,
      elapsedSec: 2700,
      movingSec: 2400,
    },
  ]);
  const analytics = computeInsights(data, [], 3, null);
  return {
    analytics,
    quality: assessImportQuality(data),
    runs: data.runs,
    data,
  };
}

export const noGoal = insightsFrom(
  Array.from({ length: 15 }, (_, i) => mkRun(i + 1, { distanceM: 10000 })),
);

export const longTermGoal = insightsFrom([mkRun(2), mkRun(5), mkRun(8)], {
  distance: "marathon",
  date: format(addDays(new Date(), 120), "yyyy-MM-dd"),
  targetTimeSec: 14400,
});

/** High volume recent block */
export function overloadedBlock() {
  const runs = Array.from({ length: 18 }, (_, i) =>
    mkRun(Math.floor(i / 2), {
      distanceM: 14000,
      movingSec: 4200,
      avgHr: 168,
      name: i % 3 === 0 ? "Hard tempo" : "Run",
    }),
  );
  return insightsFrom(runs, null);
}

/** Taper: big prior weeks, small current */
export function taperWeek() {
  const goal: RaceGoal = {
    distance: "hm",
    date: format(addDays(new Date(), 10), "yyyy-MM-dd"),
  };
  const runs = [
    ...Array.from({ length: 8 }, (_, i) => mkRun(21 + i, { distanceM: 16000, movingSec: 4800 })),
    mkRun(4, { distanceM: 6000, movingSec: 2100 }),
    mkRun(1, { distanceM: 4000, movingSec: 1500 }),
  ];
  return insightsFrom(runs, goal);
}

export function emptyQuality(): ImportQualityReport {
  return {
    runCount: 0,
    activityCount: 0,
    fitParsed: 0,
    fitReferenced: 0,
    skippedFit: 0,
    lastImport: new Date().toISOString(),
    sportTypes: [],
    fieldCoverage: [],
    warnings: ["No activities"],
    overallConfidence: "low",
  };
}
