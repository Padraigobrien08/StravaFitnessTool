import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import { RACE_DISTANCE_LABELS } from "@/lib/analytics/readiness";
import { formatDuration } from "@/lib/utils";
import type { CoachContextSnapshot } from "./types";

export function buildCoachContextSnapshot(
  analytics: DashboardInsights | null,
  raceGoal: RaceGoal | null
): CoachContextSnapshot {
  if (!analytics) {
    return {
      readinessScore: null,
      readinessLabel: null,
      freshness: null,
      fatigueLabel: null,
      tsb: null,
      raceLabel: null,
      daysToRace: null,
      projectedFinish: null,
      dataConfidence: null,
      runCount: 0,
      last7Km: 0,
      currentFocus: "Awaiting data",
      adaptationTrend: "unknown",
      adaptationLabel: "—",
      riskLevel: "low",
      riskLabel: "—",
      recommendationConfidence: "low",
      blockSummary: null,
      archetypeLabel: null,
      modalityHeadline: null,
      weekLabel: null,
    };
  }

  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;
  const consensus = analytics.racePredictionAnalysis.consensus[0];

  return {
    readinessScore: r.score,
    readinessLabel: r.label,
    freshness: analytics.fatigue.freshness,
    fatigueLabel: analytics.fatigue.label,
    tsb: analytics.fatigue.tsb,
    raceLabel: raceGoal ? RACE_DISTANCE_LABELS[raceGoal.distance] : null,
    daysToRace: analytics.raceReadiness?.daysUntilRace ?? null,
    projectedFinish: consensus ? formatDuration(consensus.timeSec) : null,
    dataConfidence: analytics.dataConfidence,
    runCount: analytics.summary.runCount,
    last7Km: Math.round(analytics.summary.last7DaysKm * 10) / 10,
    currentFocus: "Training rhythm",
    adaptationTrend: "stable",
    adaptationLabel: "Stable",
    riskLevel: "low",
    riskLabel: "Risk contained",
    recommendationConfidence: analytics.dataConfidence,
    blockSummary: null,
    archetypeLabel: null,
    modalityHeadline: null,
    weekLabel: analytics.currentWeek.weekLabel,
  };
}

export { buildCoachWorkspaceState } from "./activeIntelligence";
