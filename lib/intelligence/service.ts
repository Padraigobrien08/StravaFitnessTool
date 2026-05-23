import { computeInsights } from "@/lib/analytics";
import { generateInsights } from "@/lib/insights/generate";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { buildStravaImportFromDb } from "@/lib/db/activities";
import { getAllFitDetailsForUser } from "@/lib/db/activity-streams";
import { getStravaConnection } from "@/lib/db/strava-connection";
import { getUserPreferences } from "@/lib/db/user-preferences";
import { buildIntelligenceBrief } from "./brief";
import { buildRunCoachDetail } from "@/lib/coaching-context";
import type {
  AthleteIntelligenceBundle,
  IntelligenceBrief,
  IntelligenceContext,
  RecentRunSummary,
} from "./types";

export async function resolveIntelligenceContext(
  userId: string,
  overrides?: Partial<IntelligenceContext>
): Promise<{
  userId: string;
  raceGoal: IntelligenceContext["raceGoal"];
  settings: { defaultWeeklyRuns: number; maxWeeklyKm: number };
}> {
  const prefs = await getUserPreferences(userId);
  return {
    userId,
    raceGoal:
      overrides?.raceGoal !== undefined
        ? overrides.raceGoal
        : prefs.raceGoal,
    settings: {
      defaultWeeklyRuns:
        overrides?.settings?.defaultWeeklyRuns ??
        prefs.settings.defaultWeeklyRuns,
      maxWeeklyKm:
        overrides?.settings?.maxWeeklyKm ?? prefs.settings.maxWeeklyKm,
    },
  };
}

export async function loadAthleteDataset(userId: string) {
  const conn = await getStravaConnection(userId);
  if (!conn) {
    throw new Error("No Strava connection for user");
  }
  const importData = await buildStravaImportFromDb(userId, conn.athlete_json);
  const fitDetails = await getAllFitDetailsForUser(userId);
  const quality = assessImportQuality(importData);
  return { importData, fitDetails, quality, conn };
}

export async function computeAthleteIntelligence(
  ctx: IntelligenceContext
): Promise<AthleteIntelligenceBundle> {
  const { importData, fitDetails, quality } = await loadAthleteDataset(
    ctx.userId
  );
  const resolved = await resolveIntelligenceContext(ctx.userId, ctx);
  const maxKm =
    resolved.settings.maxWeeklyKm > 0
      ? resolved.settings.maxWeeklyKm
      : undefined;

  const analytics = computeInsights(
    importData,
    fitDetails,
    resolved.settings.defaultWeeklyRuns,
    resolved.raceGoal ?? null,
    maxKm
  );
  const insights = generateInsights(analytics, quality);

  const fitById = new Map(fitDetails.map((f) => [f.activityId, f]));
  const recentRuns: RecentRunSummary[] = [...importData.runs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .map((r) => {
      const detail = buildRunCoachDetail(
        r,
        fitById.get(r.id) ?? null,
        analytics,
        importData.runs
      );
      return {
        runId: detail.runId,
        date: detail.date,
        name: detail.name,
        type: detail.workoutType,
        distanceKm: detail.distanceKm,
        pace: detail.pace,
        durationMin: detail.durationMin,
        avgHr: detail.avgHr,
        maxHr: detail.maxHr,
        elevationGainM: detail.elevationGainM,
        executionQuality: detail.executionQuality,
        executionScore: detail.executionScore,
        lateFadePct: detail.lateFadePct,
        hrDriftPct: detail.hrDriftPct,
        fatigueCost: detail.fatigueCost,
        streams: detail.streams,
        narrative: detail.narrative,
      };
    });

  return {
    analytics,
    insights,
    quality,
    recentRuns,
    runs: importData.runs,
    fitDetails,
  };
}

export async function buildCoachBriefForUser(
  ctx: IntelligenceContext
): Promise<IntelligenceBrief> {
  const bundle = await computeAthleteIntelligence(ctx);
  const resolved = await resolveIntelligenceContext(ctx.userId, ctx);
  return buildIntelligenceBrief(
    bundle.analytics,
    bundle.insights,
    bundle.quality,
    resolved.raceGoal ?? null
  );
}
