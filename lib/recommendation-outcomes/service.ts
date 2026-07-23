import type { RunActivity } from "@/lib/strava/types";
import type { RunWorkoutLabel } from "@/lib/analytics/workoutType";
import type { TodaySessionRecommendation } from "@/lib/training/todaySession";
import { getRecommendations, logRecommendation, saveEvaluation } from "@/lib/db/recommendation-log";
import { evaluateAdherence } from "./evaluateAdherence";
import type { Adherence, LoggedRecommendation } from "./types";

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Record today's session recommendation. Fire-and-forget; never throws. */
export async function logTodaySessionRecommendation(
  userId: string,
  rec: TodaySessionRecommendation,
): Promise<void> {
  const targetDate = todayIsoUtc();
  const logged: LoggedRecommendation = {
    recommendationId: `today_session:${targetDate}`,
    producer: "today_session",
    issuedAt: new Date().toISOString(),
    targetDate,
    kind: rec.kind,
    headline: rec.headline,
    distanceKmMin: rec.distanceKmRange?.[0] ?? null,
    distanceKmMax: rec.distanceKmRange?.[1] ?? null,
  };
  try {
    await logRecommendation(userId, logged);
  } catch {
    /* non-fatal — logging must never break the recommendation itself */
  }
}

export interface RecommendationOutcomesResult {
  recommendations: LoggedRecommendation[];
  summary: {
    total: number;
    resolved: number;
    followed: number;
    adherenceRatePct: number | null;
  };
}

const RESOLVED: ReadonlySet<Adherence> = new Set(["followed", "partial", "skipped"]);

/**
 * Load logged recommendations, evaluate any still-pending ones against actual
 * runs, persist newly-resolved outcomes, and summarize adherence.
 */
export async function evaluateRecommendationOutcomes(
  userId: string,
  runs: RunActivity[],
  workoutLabels: RunWorkoutLabel[],
  now: Date = new Date(),
): Promise<RecommendationOutcomesResult> {
  const logged = await getRecommendations(userId);
  const todayIso = now.toISOString().slice(0, 10);
  const typeByRunId = new Map(workoutLabels.map((l) => [l.runId, l.classification.type]));

  const recommendations: LoggedRecommendation[] = [];
  for (const rec of logged) {
    if (rec.adherence && RESOLVED.has(rec.adherence)) {
      recommendations.push(rec);
      continue;
    }
    const res = evaluateAdherence(rec, runs, typeByRunId, todayIso);
    const updated: LoggedRecommendation = {
      ...rec,
      adherence: res.adherence,
      matchedRunIds: res.matchedRunIds,
      evaluationNote: res.note,
      evaluatedAt: now.toISOString(),
    };
    if (RESOLVED.has(res.adherence)) {
      try {
        await saveEvaluation(userId, updated);
      } catch {
        /* non-fatal — return the in-memory evaluation even if persistence fails */
      }
    }
    recommendations.push(updated);
  }

  const resolved = recommendations.filter((r) => r.adherence && RESOLVED.has(r.adherence));
  const followed = resolved.filter((r) => r.adherence === "followed").length;
  return {
    recommendations,
    summary: {
      total: recommendations.length,
      resolved: resolved.length,
      followed,
      adherenceRatePct: resolved.length > 0 ? Math.round((followed / resolved.length) * 100) : null,
    },
  };
}
