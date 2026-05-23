import type { DashboardInsights } from "@/lib/analytics";
import type { AthleteIntelligenceBundle } from "@/lib/intelligence/types";
import type { RaceGoal } from "@/lib/analytics/readiness";
import {
  buildAthleteMemoryProfile,
  updateAthleteMemoryProfile,
} from "@/lib/athlete-memory";
import {
  trackRecommendationOutcome,
  evaluatePendingOutcomes,
  getTrackedOutcomes,
  confidenceToScore,
  applyOutcomesToMemory,
} from "@/lib/recommendation-learning";
import { buildAdaptationSignals } from "@/lib/adaptation-engine";
import { inferLikelyCauses } from "@/lib/causal-reasoning";
import { buildLongitudinalComparisons } from "@/lib/longitudinal-analysis";
import { evaluateRecentSessions, sessionEffectivenessSummary } from "@/lib/session-intelligence";
import { buildReasoningContext } from "@/lib/reasoning/context";
import { buildLearningObservabilityReport } from "@/lib/learning-observability";
import type { AdaptiveIntelligenceSnapshot } from "./types";
import { getPrimaryRecommendation } from "@/lib/intelligence/athleteState";
import { buildCoachWorkspaceState } from "@/lib/coach/activeIntelligence";
import type { Insight } from "@/lib/insights/types";

export function buildAdaptiveIntelligence(
  bundle: AthleteIntelligenceBundle,
  raceGoal: RaceGoal | null,
  insights: Insight[] = [],
  athleteKey = "default",
  opts?: { trackPrimaryRecommendation?: boolean }
): AdaptiveIntelligenceSnapshot {
  const analytics = bundle.analytics;
  const state = buildCoachWorkspaceState(
    analytics,
    insights,
    raceGoal
  );

  const primaryRec = state
    ? getPrimaryRecommendation(state, analytics)
    : analytics.intensityAdvice.recommendations[0] ?? "Maintain aerobic rhythm";

  if (opts?.trackPrimaryRecommendation) {
    trackRecommendationOutcome(athleteKey, {
      recommendationId: `primary-${analytics.currentWeek.weekStart}`,
      recommendation: primaryRec,
      expectedOutcome: [
        "freshness",
        "readiness",
        "sustainable intensity",
      ],
      confidenceBefore: confidenceToScore(analytics.dataConfidence),
    });
  }

  const outcomes = evaluatePendingOutcomes(athleteKey, analytics);
  let memory = buildAthleteMemoryProfile(analytics, athleteKey);
  memory = applyOutcomesToMemory(memory, outcomes);

  const sessionCtx = buildReasoningContext(bundle, raceGoal);
  const labelById = new Map(
    analytics.workoutLabels.map((l) => [l.runId, l.classification])
  );
  const recentSessions = evaluateRecentSessions(
    sessionCtx.runs,
    sessionCtx.fitByRunId,
    labelById,
    analytics,
    5
  );
  const sessionSummary = sessionEffectivenessSummary(recentSessions);

  if (sessionSummary.length) {
    memory = updateAthleteMemoryProfile(memory, {
      observedAt: new Date().toISOString(),
      supporting: {
        adaptation: sessionSummary.slice(0, 2),
      },
    });
  }

  const adaptationSignals = buildAdaptationSignals(analytics, outcomes);
  const comparisons = buildLongitudinalComparisons(bundle, raceGoal);

  const causalReadiness = inferLikelyCauses(analytics, "readiness");
  const causalFatigue = inferLikelyCauses(analytics, "fatigue");

  const recentlyLearned = buildRecentlyLearned(
    memory,
    adaptationSignals,
    outcomes,
    sessionSummary
  );

  const observability = buildLearningObservabilityReport({
    memory,
    adaptationSignals,
    outcomes: getTrackedOutcomes(athleteKey),
    causalSnapshots: [causalReadiness, causalFatigue],
  });

  return {
    generatedAt: new Date().toISOString(),
    memory,
    adaptationSignals,
    recommendationOutcomes: outcomes,
    recentSessions,
    sessionSummary,
    longitudinalComparisons: comparisons,
    causal: {
      readiness: causalReadiness,
      fatigue: causalFatigue,
    },
    recentlyLearned,
    observability,
    primaryRecommendation: primaryRec,
  };
}

function buildRecentlyLearned(
  memory: ReturnType<typeof buildAthleteMemoryProfile>,
  signals: ReturnType<typeof buildAdaptationSignals>,
  outcomes: ReturnType<typeof evaluatePendingOutcomes>,
  sessionNotes: string[]
): string[] {
  const items: string[] = [];

  for (const o of outcomes) {
    if (o.evaluation === "supported") {
      items.push(`Recommendation supported: ${o.recommendation.slice(0, 90)}`);
    } else if (o.evaluation === "contradicted") {
      items.push(`Prior advice contradicted — ${o.recommendation.slice(0, 70)}`);
    }
  }

  for (const s of signals.filter((x) => x.confidence !== "low").slice(0, 4)) {
    items.push(s.statement);
  }

  const beliefs = [
    ...memory.adaptationPatterns,
    ...memory.fatiguePatterns,
    ...memory.taperResponses,
  ].filter((b) => b.stability === "emerging" || b.lastUpdated);

  for (const b of beliefs.slice(0, 3)) {
    items.push(b.statement);
  }

  items.push(...sessionNotes.slice(0, 2));

  const seen = new Set<string>();
  return items
    .filter((i) => {
      const k = i.slice(0, 40).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8);
}
