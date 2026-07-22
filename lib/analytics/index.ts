import type { StravaImport } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { activityTypeMix } from "./context";
import { runGoalProgress } from "./goals";
import { easyHardSplit, hrZoneDistribution } from "./hrZones";
import {
  halfMarathonReadiness,
  raceReadiness,
  type RaceGoal,
  type RaceReadiness,
} from "./readiness";
import { findPersonalRecords, racePredictions } from "./records";
import { buildRacePredictionAnalysis, type RacePredictionAnalysis } from "./predictions";
import { fitnessIndex, loadByRun } from "./trainingLoad";
import { hrTrend, paceTrend, rollingAveragePace } from "./trends";
import { lastNDaysVolume, monthlyVolume, weeklyVolume } from "./volume";
import { paceSecPerKm } from "./pace";
import {
  aerobicEfficiencyTrend,
  efficiencySummary,
  efficiencyMonthOverMonth,
  type EfficiencyMonthOverMonth,
} from "./efficiency";
import {
  buildFatigueSnapshot,
  acuteChronicLoad,
  weeklyLoadSeries,
  type FatigueSnapshot,
} from "./fatigue";
import { elevationPerKm, avgElevationPerKm } from "./elevation";
import { rollingFourWeekBlocks, bestTrainingBlock } from "./block";
import { buildCurrentAndPreviousWeek, type WeekSnapshot } from "./week";
import { buildWeeklyNarrative, type WeeklyNarrative } from "./narrative";
import { buildConsistencyScore, type ConsistencyScore } from "./consistency";
import { buildIntensityAdvice, type IntensityAdvice } from "./intensityAdvisor";
import {
  buildPrTimeline,
  buildPredictionTimeline,
  type PrTimelinePoint,
  type PredictionTimelinePoint,
} from "./progression";
import {
  classifyAllRuns,
  workoutTypeDistribution,
  type RunWorkoutLabel,
  type WorkoutTypeBucket,
} from "./workoutType";
import {
  buildNextWeekPlan,
  buildPlanContextFromInsights,
  type WeekPlan,
} from "@/lib/training/planEngine";
import { simulateRaceStrategy, type RaceStrategy } from "./raceStrategy";
import { computeTrainingEcosystem, type TrainingEcosystemAnalysis } from "@/lib/ecosystem";

export interface DashboardInsights {
  summary: {
    runCount: number;
    totalDistanceKm: number;
    dateRange: { start: string; end: string } | null;
    avgPaceSecPerKm: number | null;
    avgHr: number | null;
    last7DaysKm: number;
    last7DaysRuns: number;
  };
  weeklyVolume: ReturnType<typeof weeklyVolume>;
  monthlyVolume: ReturnType<typeof monthlyVolume>;
  paceTrend: ReturnType<typeof paceTrend>;
  rollingPace: ReturnType<typeof rollingAveragePace>;
  hrTrend: ReturnType<typeof hrTrend>;
  hrZones: ReturnType<typeof hrZoneDistribution>;
  easyHard: ReturnType<typeof easyHardSplit>;
  personalRecords: ReturnType<typeof findPersonalRecords>;
  racePredictions: ReturnType<typeof racePredictions>;
  racePredictionAnalysis: RacePredictionAnalysis;
  goalProgress: ReturnType<typeof runGoalProgress>;
  trainingLoadByRun: ReturnType<typeof loadByRun>;
  fitnessIndex: ReturnType<typeof fitnessIndex>;
  halfMarathonReadiness: ReturnType<typeof halfMarathonReadiness>;
  activityMix: ReturnType<typeof activityTypeMix>;
  athleteMaxHr: number;
  dataConfidence: "low" | "medium" | "high";
  efficiencyTrend: ReturnType<typeof aerobicEfficiencyTrend>;
  efficiencySummary: ReturnType<typeof efficiencySummary>;
  elevationPerKm: ReturnType<typeof elevationPerKm>;
  avgElevationPerKm: number | null;
  trainingBlocks: ReturnType<typeof rollingFourWeekBlocks>;
  bestBlock: ReturnType<typeof bestTrainingBlock>;
  fitRunCount: number;
  currentWeek: WeekSnapshot;
  previousWeek: WeekSnapshot | null;
  weeklyNarrative: WeeklyNarrative;
  consistencyScore: ConsistencyScore;
  intensityAdvice: IntensityAdvice;
  prTimeline: PrTimelinePoint[];
  predictionTimeline: PredictionTimelinePoint[];
  fatigue: FatigueSnapshot;
  loadHistory: ReturnType<typeof acuteChronicLoad>["history"];
  efficiencyMoM: EfficiencyMonthOverMonth;
  raceReadiness: RaceReadiness | null;
  workoutLabels: RunWorkoutLabel[];
  workoutTypeMix: WorkoutTypeBucket[];
  nextWeekPlan: WeekPlan;
  raceStrategy: RaceStrategy | null;
  trainingEcosystem: TrainingEcosystemAnalysis;
}

const DEFAULT_MAX_HR = 190;

export function computeInsights(
  data: StravaImport,
  fitDetails: FitRunDetail[] = [],
  defaultWeeklyRuns = 3,
  raceGoal: RaceGoal | null = null,
  maxWeeklyKm?: number,
): DashboardInsights {
  const { runs, profile, goals, allActivities } = data;
  const athleteMaxHr = profile.maxHeartRate ?? DEFAULT_MAX_HR;

  const paces = runs.map(paceSecPerKm).filter((p): p is number => p !== null);
  const hrs = runs.map((r) => r.avgHr).filter((h): h is number => h !== null);

  const last7 = lastNDaysVolume(runs, 7);
  const pacePoints = paceTrend(runs);
  const efficiencyPoints = aerobicEfficiencyTrend(runs);
  const elevPoints = elevationPerKm(runs);
  const blocks = rollingFourWeekBlocks(runs);

  let dataConfidence: "low" | "medium" | "high" = "low";
  if (runs.length >= 40) dataConfidence = "high";
  else if (runs.length >= 20) dataConfidence = "medium";

  const goalProgress = runGoalProgress(runs, goals);
  const efficiencySummaryResult = efficiencySummary(efficiencyPoints);
  const { current: currentWeek, previous: previousWeek } = buildCurrentAndPreviousWeek(
    runs,
    athleteMaxHr,
  );
  const weeklyNarrative = buildWeeklyNarrative(
    runs,
    {
      athleteMaxHr,
      dataConfidence,
      goalProgress,
      efficiencySummary: efficiencySummaryResult,
    },
    0,
    defaultWeeklyRuns,
  );

  const easyHard = easyHardSplit(runs, athleteMaxHr);
  const consistencyScore = buildConsistencyScore(runs, goalProgress, defaultWeeklyRuns);
  const intensityAdvice = buildIntensityAdvice(runs, athleteMaxHr, easyHard);
  const prTimeline = buildPrTimeline(runs, fitDetails);
  const predictionTimeline = buildPredictionTimeline(runs, fitDetails);
  const loadSeries = weeklyLoadSeries(runs);
  const loadHistory = acuteChronicLoad(loadSeries).history;
  const fatigue = buildFatigueSnapshot(runs);
  const efficiencyMoM = efficiencyMonthOverMonth(efficiencyPoints);
  const personalRecords = findPersonalRecords(runs, fitDetails);
  const racePredictionAnalysis = buildRacePredictionAnalysis(runs, fitDetails);
  const raceReadinessResult = raceGoal
    ? raceReadiness(runs, raceGoal, personalRecords, racePredictionAnalysis)
    : null;
  const workoutLabels = classifyAllRuns(runs, fitDetails, athleteMaxHr);
  const workoutTypeMix = workoutTypeDistribution(workoutLabels, 56);
  const trainingEcosystem = computeTrainingEcosystem(data, workoutLabels, dataConfidence, raceGoal);
  const weeks = weeklyVolume(runs);
  const hmReadiness = halfMarathonReadiness(runs);

  const raceStrategyResult = raceGoal
    ? simulateRaceStrategy(raceGoal, racePredictionAnalysis, fatigue, raceReadinessResult, "even")
    : null;

  const nextWeekPlan = buildNextWeekPlan(
    buildPlanContextFromInsights(
      {
        fatigue,
        intensityAdvice,
        consistencyScore,
        raceReadiness: raceReadinessResult,
        currentWeek,
        previousWeek,
        weeklyVolume: weeks,
        easyHard,
        goalProgress,
        halfMarathonReadiness: hmReadiness,
      },
      {
        runsPerWeekTarget: goalProgress?.targetPerWeek ?? defaultWeeklyRuns,
        maxWeeklyKm,
      },
    ),
  );

  return {
    summary: {
      runCount: runs.length,
      totalDistanceKm: Math.round(runs.reduce((s, r) => s + r.distanceM / 1000, 0) * 10) / 10,
      dateRange: runs.length > 0 ? { start: runs[0].date, end: runs[runs.length - 1].date } : null,
      avgPaceSecPerKm: paces.length > 0 ? paces.reduce((a, b) => a + b, 0) / paces.length : null,
      avgHr: hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      last7DaysKm: Math.round(last7.distanceKm * 10) / 10,
      last7DaysRuns: last7.runCount,
    },
    weeklyVolume: weeks,
    monthlyVolume: monthlyVolume(runs),
    paceTrend: pacePoints,
    rollingPace: rollingAveragePace(pacePoints),
    hrTrend: hrTrend(runs),
    hrZones: hrZoneDistribution(runs, athleteMaxHr),
    easyHard,
    personalRecords,
    racePredictionAnalysis,
    racePredictions: racePredictions(runs, fitDetails),
    goalProgress,
    trainingLoadByRun: loadByRun(runs),
    fitnessIndex: fitnessIndex(runs),
    halfMarathonReadiness: hmReadiness,
    activityMix: activityTypeMix(allActivities),
    athleteMaxHr,
    dataConfidence,
    efficiencyTrend: efficiencyPoints,
    efficiencySummary: efficiencySummaryResult,
    elevationPerKm: elevPoints,
    avgElevationPerKm: avgElevationPerKm(elevPoints),
    trainingBlocks: blocks,
    bestBlock: bestTrainingBlock(blocks),
    fitRunCount: data.fitRunIds?.length ?? 0,
    currentWeek,
    previousWeek,
    weeklyNarrative,
    consistencyScore,
    intensityAdvice,
    prTimeline,
    predictionTimeline,
    fatigue,
    loadHistory,
    efficiencyMoM,
    raceReadiness: raceReadinessResult,
    workoutLabels,
    workoutTypeMix,
    nextWeekPlan,
    raceStrategy: raceStrategyResult,
    trainingEcosystem,
  };
}

export * from "./context";
export * from "./goals";
export * from "./hrZones";
export * from "./pace";
export * from "./readiness";
export * from "./records";
export * from "./trainingLoad";
export * from "./trends";
export * from "./volume";
export * from "./efficiency";
export * from "./elevation";
export * from "./block";
export * from "./predictions";
export * from "./week";
export * from "./narrative";
export * from "./consistency";
export * from "./intensityAdvisor";
export * from "./progression";
export * from "./fatigue";
export * from "./workoutType";
export * from "./raceStrategy";
