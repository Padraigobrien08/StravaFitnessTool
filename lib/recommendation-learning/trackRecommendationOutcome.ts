import type { DashboardInsights } from "@/lib/analytics";
import { buildOutcomeEvidenceFromAnalytics } from "./buildOutcomeEvidence";
import {
  confidenceToScore,
  evaluateRecommendationOutcome,
} from "./evaluateRecommendationOutcome";
import type {
  OutcomeTrackingInput,
  TrackedRecommendationOutcome,
} from "./types";

const MAX_STORED = 40;

/** In-memory store per process — replace with DB when persistence lands */
const outcomeStore = new Map<string, TrackedRecommendationOutcome[]>();

export function trackRecommendationOutcome(
  athleteKey: string,
  input: OutcomeTrackingInput
): TrackedRecommendationOutcome {
  const pending: TrackedRecommendationOutcome = {
    recommendationId: input.recommendationId,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    recommendation: input.recommendation,
    expectedOutcome: input.expectedOutcome,
    observedSignals: [],
    evaluation: "inconclusive",
    confidenceBefore:
      input.confidenceBefore ?? confidenceToScore("medium"),
    evidence: [],
  };

  const list = outcomeStore.get(athleteKey) ?? [];
  const filtered = list.filter((o) => o.recommendationId !== input.recommendationId);
  filtered.unshift(pending);
  outcomeStore.set(athleteKey, filtered.slice(0, MAX_STORED));
  return pending;
}

export function getTrackedOutcomes(athleteKey: string): TrackedRecommendationOutcome[] {
  return [...(outcomeStore.get(athleteKey) ?? [])];
}

export function evaluatePendingOutcomes(
  athleteKey: string,
  analytics: DashboardInsights,
  priorSnapshot?: { freshness?: number; tsb?: number; readiness?: number }
): TrackedRecommendationOutcome[] {
  const list = outcomeStore.get(athleteKey) ?? [];
  const evidence = buildOutcomeEvidenceFromAnalytics(analytics, priorSnapshot);
  const updated = list.map((o) => {
    if (o.evaluatedAt && o.evaluation !== "inconclusive") return o;
    const withSignals = {
      ...o,
      observedSignals: evidence,
      evidence,
    };
    return evaluateRecommendationOutcome({
      outcome: withSignals,
      freshness: analytics.fatigue.freshness,
      tsb: analytics.fatigue.tsb,
      readinessScore:
        analytics.raceReadiness?.score ??
        analytics.halfMarathonReadiness.score,
      efficiencyTrend: analytics.efficiencySummary.trend,
      hardRuns14d: analytics.intensityAdvice.hardRunsLast14d,
    });
  });
  outcomeStore.set(athleteKey, updated);
  return updated;
}

export function clearOutcomeStore(athleteKey?: string): void {
  if (athleteKey) outcomeStore.delete(athleteKey);
  else outcomeStore.clear();
}
