import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { NormalizedActivity } from "@/lib/ecosystem/types";
import { buildForecastV2View } from "@/lib/goals/forecastV2ViewModel";
import type { AthleteIntelligenceBundle } from "@/lib/intelligence/types";
import { buildActiveObservations } from "@/lib/coach/activeIntelligence";
import { buildAthleteStateSummary } from "./buildAthleteStateSummary";
import { buildConstraints } from "./buildConstraints";
import { buildDataQualityContext } from "./buildDataQuality";
import { buildForecastContext } from "./buildForecastContext";
import { buildGoalContext } from "./buildGoalContext";
import { buildAthleteProfileSummary, buildMemoryPatterns } from "./buildMemoryContext";
import { buildModalityContext } from "./buildModalityContext";
import { buildRecentTrainingBlock } from "./buildRecentTrainingBlock";
import { buildRecentSessionDetails } from "./buildRecentSessionDetails";
import { buildRecommendationContext } from "./buildRecommendationContext";
import { buildRiskContext } from "./buildRiskContext";
import type { CoachingContext, CoachingContextOptions, NotableSession } from "./types";

export interface BuildCoachingContextParams {
  analytics: DashboardInsights;
  quality: ImportQualityReport;
  runs: RunActivity[];
  fitDetails?: FitRunDetail[];
  raceGoal?: RaceGoal | null;
  normalizedActivities?: NormalizedActivity[];
  maxWeeklyKm?: number;
  options?: CoachingContextOptions;
}

export function buildCoachingContext(params: BuildCoachingContextParams): CoachingContext {
  const opts = params.options ?? {};
  const windowDays = opts.windowDays ?? 28;
  const includeModality = opts.includeModality !== false;
  const includeForecast = opts.includeForecast !== false;
  const includeMemory = opts.includeMemory !== false;

  const activities = params.normalizedActivities ?? params.analytics.trainingEcosystem.activities;

  const recentTraining = buildRecentTrainingBlock({
    runs: params.runs,
    normalizedActivities: activities,
    raceGoal: params.raceGoal ?? null,
    windowDays,
  });

  if (opts.includeRawSessions) {
    recentTraining.notableSessions = appendRawSessions(
      recentTraining.notableSessions,
      params.runs,
      8,
    );
  }

  const observations = buildActiveObservations(params.analytics, []);
  const { risks, opportunities } = buildRiskContext(params.analytics, observations);

  let forecast = undefined;
  if (includeForecast && params.raceGoal) {
    const view = buildForecastV2View({
      analytics: params.analytics,
      goal: params.raceGoal,
      runs: params.runs,
      fitDetails: params.fitDetails,
    });
    forecast = buildForecastContext(view);
  }

  const eco = params.analytics.trainingEcosystem;
  const patterns = includeMemory
    ? buildMemoryPatterns(params.analytics, params.raceGoal ?? null)
    : [];

  const modalityContext = includeModality
    ? buildModalityContext(params.analytics)
    : {
        athleteArchetype: eco.archetype.archetype,
        modalityDistribution: {},
        crossTrainingSummary: "Modality context omitted.",
        strengthSummary: "",
        mobilitySummary: "",
        interferenceRisks: [],
      };

  const includeSessionDetails = opts.includeSessionDetails !== false;
  const recentSessionDetails = includeSessionDetails
    ? buildRecentSessionDetails({
        runs: params.runs,
        fitDetails: params.fitDetails,
        analytics: params.analytics,
        limit: opts.sessionDetailLimit,
        windowDays: windowDays + 14,
      })
    : [];

  return {
    generatedAt: new Date().toISOString(),
    athlete: {
      archetype: eco.archetype.archetype,
      profileSummary: buildAthleteProfileSummary(params.analytics),
      knownPatterns: patterns,
    },
    goal: buildGoalContext(params.raceGoal),
    currentState: buildAthleteStateSummary(params.analytics),
    recentTraining,
    recentSessionDetails,
    forecast,
    modalityContext,
    risks,
    opportunities,
    constraints: buildConstraints(params.analytics, params.maxWeeklyKm),
    recommendationHistory: buildRecommendationContext({
      recentRecommendations: opts.recentRecommendations,
      observedOutcomes: opts.observedOutcomes,
    }),
    dataQuality: buildDataQualityContext(params.analytics, params.quality, params.runs),
  };
}

export function buildCoachingContextFromBundle(
  bundle: AthleteIntelligenceBundle,
  raceGoal: RaceGoal | null,
  maxWeeklyKm?: number,
  options?: CoachingContextOptions,
): CoachingContext {
  return buildCoachingContext({
    analytics: bundle.analytics,
    quality: bundle.quality,
    runs: bundle.runs,
    fitDetails: bundle.fitDetails,
    raceGoal,
    maxWeeklyKm,
    options,
  });
}

function appendRawSessions(
  existing: NotableSession[],
  runs: RunActivity[],
  max: number,
): NotableSession[] {
  const extra = [...runs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, max)
    .map((r) => ({
      date: r.date.slice(0, 10),
      label: r.name,
      distanceKm: Math.round((r.distanceM / 1000) * 10) / 10,
      durationMin: Math.round(r.movingSec / 60),
      type: "run",
      note: "Raw session (explicit opt-in)",
    }));
  const seen = new Set(existing.map((s) => `${s.date}-${s.label}`));
  return [...existing, ...extra.filter((s) => !seen.has(`${s.date}-${s.label}`))].slice(
    0,
    max + existing.length,
  );
}
