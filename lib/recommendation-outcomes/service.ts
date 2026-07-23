import type { RunActivity } from "@/lib/strava/types";
import type { RunWorkoutLabel } from "@/lib/analytics/workoutType";
import type { TodaySessionRecommendation } from "@/lib/training/todaySession";
import { getRecommendations, logRecommendation, saveEvaluation } from "@/lib/db/recommendation-log";
import { evaluateRecommendationOutcome } from "@/lib/recommendation-learning/evaluateRecommendationOutcome";
import { evaluateAdherence } from "./evaluateAdherence";
import type { Adherence, LoggedRecommendation } from "./types";

/** Current analytics signals used to judge whether a followed recommendation worked. */
export interface SignalSnapshot {
  freshness?: number;
  tsb?: number;
  readinessScore?: number;
  efficiencyTrend?: "improving" | "declining" | "stable" | null;
  hardRuns14d?: number;
}

/** Days a followed recommendation must age before its physiological effect is judged. */
const SIGNAL_MIN_AGE_DAYS = 2;

function expectedOutcomeFor(kind: string): string[] {
  switch (kind) {
    case "rest":
    case "recovery":
    case "easy":
      return ["freshness recovers", "fatigue absorbed"];
    case "tempo":
    case "interval":
      return ["threshold fitness improves", "aerobic efficiency improving"];
    case "long":
      return ["endurance builds", "aerobic efficiency improving"];
    default:
      return ["training adaptation"];
  }
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

export function evaluateSignal(
  rec: LoggedRecommendation,
  snap: SignalSnapshot,
): { signal: LoggedRecommendation["outcomeSignal"]; note: string } {
  const tracked = evaluateRecommendationOutcome({
    outcome: {
      recommendationId: rec.recommendationId,
      issuedAt: rec.issuedAt,
      recommendation: `${rec.kind} ${rec.headline}`,
      expectedOutcome: expectedOutcomeFor(rec.kind),
      observedSignals: [],
      evaluation: "inconclusive",
      confidenceBefore: 0.5,
      evidence: [],
    },
    freshness: snap.freshness,
    tsb: snap.tsb,
    readinessScore: snap.readinessScore,
    efficiencyTrend: snap.efficiencyTrend,
    hardRuns14d: snap.hardRuns14d,
  });
  return { signal: tracked.evaluation, note: tracked.observedSignals.slice(0, 3).join(" · ") };
}

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
    /** Followed recs whose signal was evaluated. */
    signalEvaluated: number;
    supported: number;
    contradicted: number;
  };
}

const RESOLVED: ReadonlySet<Adherence> = new Set(["followed", "partial", "skipped"]);

/**
 * Load logged recommendations, resolve adherence for still-pending ones against
 * actual runs, judge the outcome signal for followed recs old enough to show an
 * effect, persist newly-resolved records, and summarize.
 *
 * @param signal Current analytics snapshot; omit to skip outcome-signal scoring.
 */
export async function evaluateRecommendationOutcomes(
  userId: string,
  runs: RunActivity[],
  workoutLabels: RunWorkoutLabel[],
  signal?: SignalSnapshot,
  now: Date = new Date(),
): Promise<RecommendationOutcomesResult> {
  const logged = await getRecommendations(userId);
  const todayIso = now.toISOString().slice(0, 10);
  const typeByRunId = new Map(workoutLabels.map((l) => [l.runId, l.classification.type]));

  const recommendations: LoggedRecommendation[] = [];
  for (const rec of logged) {
    let updated = rec;
    const alreadyResolved = !!rec.adherence && RESOLVED.has(rec.adherence);

    if (!alreadyResolved) {
      const res = evaluateAdherence(rec, runs, typeByRunId, todayIso);
      updated = {
        ...rec,
        adherence: res.adherence,
        matchedRunIds: res.matchedRunIds,
        evaluationNote: res.note,
        evaluatedAt: now.toISOString(),
      };
    }

    // Judge the signal once: followed, aged enough, snapshot available, not yet scored.
    const signalEligible =
      updated.adherence === "followed" &&
      signal != null &&
      !updated.outcomeSignal &&
      daysBetween(updated.targetDate, todayIso) >= SIGNAL_MIN_AGE_DAYS;
    if (signalEligible) {
      const s = evaluateSignal(updated, signal);
      updated = { ...updated, outcomeSignal: s.signal, outcomeNote: s.note };
    }

    const newlyResolved = !alreadyResolved && RESOLVED.has(updated.adherence!);
    const signalAdded = !!updated.outcomeSignal && !rec.outcomeSignal;
    if (newlyResolved || signalAdded) {
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
  const scored = recommendations.filter((r) => r.outcomeSignal);
  return {
    recommendations,
    summary: {
      total: recommendations.length,
      resolved: resolved.length,
      followed,
      adherenceRatePct: resolved.length > 0 ? Math.round((followed / resolved.length) * 100) : null,
      signalEvaluated: scored.length,
      supported: scored.filter((r) => r.outcomeSignal === "supported").length,
      contradicted: scored.filter((r) => r.outcomeSignal === "contradicted").length,
    },
  };
}
