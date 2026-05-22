import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { Insight } from "@/lib/insights/types";
import { buildCoachWorkspaceState } from "@/lib/coach/activeIntelligence";
import {
  buildDefaultInvestigation,
  DEFAULT_INVESTIGATION_QUESTION,
} from "@/lib/coach/defaultInvestigation";
import type {
  ActiveObservation,
  CoachWorkspaceState,
  CoachingDomain,
  RiskOpportunity,
} from "@/lib/coach/types";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import { buildTrainingEcosystemView } from "@/lib/training/ecosystemViewModel";
import type { TrainingEcosystemView } from "@/lib/training/ecosystemViewModel";

export interface IntelligenceSignal {
  id: string;
  type: string;
  severity: "positive" | "neutral" | "warning" | "opportunity";
  text: string;
  evidence: string;
  confidence: "low" | "medium" | "high";
}

export interface TrajectorySeries {
  id: string;
  label: string;
  values: { label: string; value: number }[];
  trend: "up" | "down" | "flat";
}

/** Full athlete intelligence model for Intelligence + Coach surfaces */
export function getAthleteIntelligenceState(
  analytics: DashboardInsights | null,
  insights: Insight[],
  raceGoal: RaceGoal | null,
  threadMessages: import("@/lib/coach/types").CoachMessage[] = []
): CoachWorkspaceState | null {
  if (!analytics) return null;
  return buildCoachWorkspaceState(analytics, insights, raceGoal, threadMessages);
}

export function getActiveSignals(
  state: CoachWorkspaceState
): IntelligenceSignal[] {
  return state.observations.map((o) => ({
    id: o.id,
    type: o.domain,
    severity: o.tone,
    text: o.text,
    evidence: o.text,
    confidence: o.confidence,
  }));
}

export function getLongitudinalMemory(
  state: CoachWorkspaceState
): MemorySnippet[] {
  return state.memory;
}

export function getRisksAndOpportunities(
  state: CoachWorkspaceState
): RiskOpportunity[] {
  return state.risksAndOpportunities;
}

export function getTrainingEcosystem(
  analytics: DashboardInsights
): TrainingEcosystemView {
  return buildTrainingEcosystemView(analytics);
}

export function getCoachDefaultInvestigation(
  analytics: DashboardInsights,
  raceGoal: RaceGoal | null
) {
  return buildDefaultInvestigation(analytics, raceGoal);
}

export { DEFAULT_INVESTIGATION_QUESTION };

export function getCoachDomainContext(
  state: CoachWorkspaceState,
  domainId: string | null
): CoachingDomain | null {
  if (!domainId) return state.domains[0] ?? null;
  return state.domains.find((d) => d.id === domainId) ?? null;
}

export function getPrimaryRecommendation(
  state: CoachWorkspaceState,
  analytics: DashboardInsights
): string {
  if (analytics.fatigue.tsb < -12) {
    return "Prioritize recovery — cap hard sessions and protect easy aerobic rhythm until freshness rebounds.";
  }
  if (analytics.raceReadiness && analytics.raceReadiness.daysUntilRace <= 14) {
    return "Preserve freshness. Cap hard sessions at one per week and use easy aerobic work to maintain rhythm before race day.";
  }
  if (analytics.intensityAdvice.status === "too_hard") {
    return "Reduce intensity stacking — redistribute hard days and add easy volume between quality sessions.";
  }
  if (analytics.efficiencySummary.trend === "improving") {
    return "Protect the aerobic adaptation trend with polarized easy days between quality work.";
  }
  return state.focusRationale || "Maintain consistent aerobic rhythm and align hard sessions with freshness windows.";
}

export function getTrajectorySeries(
  analytics: DashboardInsights
): TrajectorySeries[] {
  const weeks = analytics.weeklyVolume.slice(-8);
  const vol: TrajectorySeries = {
    id: "volume",
    label: "Weekly volume",
    values: weeks.map((w) => ({ label: w.label, value: w.distanceKm })),
    trend:
      weeks.length >= 2 &&
      weeks[weeks.length - 1]!.distanceKm > weeks[weeks.length - 2]!.distanceKm
        ? "up"
        : weeks.length >= 2 &&
            weeks[weeks.length - 1]!.distanceKm < weeks[weeks.length - 2]!.distanceKm
          ? "down"
          : "flat",
  };

  const eff = analytics.efficiencyTrend.slice(-8);
  const efficiency: TrajectorySeries = {
    id: "efficiency",
    label: "Aerobic efficiency",
    values: eff.map((p) => ({
      label: p.label,
      value: p.efficiency,
    })),
    trend:
      analytics.efficiencySummary.trend === "improving"
        ? "up"
        : analytics.efficiencySummary.trend === "declining"
          ? "down"
          : "flat",
  };

  const readiness: TrajectorySeries = {
    id: "readiness",
    label: "Race readiness",
    values: weeks.map((w) => ({
      label: w.label,
      value:
        analytics.raceReadiness?.score ??
        analytics.halfMarathonReadiness.score,
    })),
    trend: "flat",
  };

  const freshness: TrajectorySeries = {
    id: "freshness",
    label: "Freshness",
    values: weeks.map((w, i) => ({
      label: w.label,
      value: Math.max(
        0,
        Math.min(
          100,
          analytics.fatigue.freshness +
            (i - weeks.length + 1) * (analytics.fatigue.tsb > 0 ? 2 : -1)
        )
      ),
    })),
    trend: analytics.fatigue.tsb > 0 ? "up" : analytics.fatigue.tsb < -8 ? "down" : "flat",
  };

  return [readiness, freshness, efficiency, vol];
}

export function getCoachingStateBullets(
  state: CoachWorkspaceState,
  analytics: DashboardInsights
): string[] {
  const bullets: string[] = [];
  if (analytics.fatigue.freshness >= 65) bullets.push("Freshness high");
  else if (analytics.fatigue.freshness < 45) bullets.push("Freshness low");
  if (state.snapshot.readinessScore != null) {
    bullets.push(`Readiness ${state.snapshot.readinessLabel?.toLowerCase() ?? "stable"}`);
  }
  if (analytics.efficiencySummary.trend === "improving") {
    bullets.push("Aerobic adaptation improving");
  }
  if (analytics.intensityAdvice.status === "too_hard") {
    bullets.push("Intensity stacking elevated");
  }
  if (state.snapshot.riskLevel !== "low") {
    bullets.push(state.snapshot.riskLabel);
  }
  return bullets.slice(0, 5);
}
