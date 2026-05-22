import { computeInsights } from "@/lib/analytics";
import { generateInsights } from "@/lib/insights/generate";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { buildStravaImportFromDb } from "@/lib/db/activities";
import { getAllFitDetailsForUser } from "@/lib/db/activity-streams";
import { getStravaConnection } from "@/lib/db/strava-connection";
import { getUserPreferences } from "@/lib/db/user-preferences";
import { buildIntelligenceBrief } from "./brief";
import { formatPace } from "@/lib/utils";
import { paceSecPerKm } from "@/lib/analytics/pace";
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

  const labelById = new Map(
    analytics.workoutLabels.map((l) => [l.runId, l.classification.type])
  );
  const recentRuns: RecentRunSummary[] = [...importData.runs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .map((r) => {
      const type = labelById.get(r.id) ?? "unknown";
      const pace = paceSecPerKm(r);
      return {
        runId: r.id,
        date: r.date,
        name: r.name,
        type,
        distanceKm: Math.round((r.distanceM / 1000) * 10) / 10,
        pace: pace ? formatPace(pace) : null,
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
