import type { DashboardInsights } from "@/lib/analytics";
import type { Insight } from "@/lib/insights/types";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { RiskOpportunity } from "@/lib/coach/types";
import { buildCurrentBelief } from "@/lib/intelligence/presentation";
import { getPrimaryRecommendation } from "@/lib/intelligence/athleteState";
import { formatKm } from "@/lib/utils";

export interface CommandCenterViewModel {
  nextAction: string;
  currentBelief: string;
  primaryRisk: { label: string; summary: string } | null;
  primaryOpportunity: { label: string; summary: string } | null;
  raceContext: string | null;
  planHint: string;
  focusLabel: string;
  confidence: "low" | "medium" | "high";
  hasSavedPlan: boolean;
  savedPlanSummary: string | null;
}

export function buildCommandCenterView(
  analytics: DashboardInsights,
  insights: Insight[],
  state: CoachWorkspaceState | null,
  risksAndOpportunities: RiskOpportunity[],
  savedPlan?: { summary: string } | null,
): CommandCenterViewModel {
  const nextAction = state
    ? getPrimaryRecommendation(state, analytics)
    : (analytics.intensityAdvice.recommendations[0] ??
      "Review your week and keep easy days between quality sessions.");

  const currentBelief = state
    ? buildCurrentBelief(state, analytics)
    : buildBeliefFromAnalytics(analytics);

  const risks = risksAndOpportunities.filter((r) => r.kind === "risk");
  const opportunities = risksAndOpportunities.filter((r) => r.kind === "opportunity");

  const primaryRisk = risks[0] ? { label: risks[0].domain, summary: risks[0].text } : null;
  const primaryOpportunity = opportunities[0]
    ? { label: opportunities[0].domain, summary: opportunities[0].text }
    : null;

  let raceContext: string | null = null;
  const r = analytics.raceReadiness;
  if (r) {
    raceContext = `${r.distanceLabel} in ${r.daysUntilRace}d · ${r.label.toLowerCase()}`;
  } else if (analytics.halfMarathonReadiness.score >= 70) {
    raceContext = `HM fitness ${analytics.halfMarathonReadiness.label.toLowerCase()} — set a goal for race-specific planning`;
  }

  const planHint = r
    ? r.daysUntilRace <= 14
      ? "Taper-aware plan recommended"
      : "Build from current load and goal"
    : "Adaptive plan from athlete state";

  return {
    nextAction,
    currentBelief,
    primaryRisk,
    primaryOpportunity,
    raceContext,
    planHint: savedPlan ? "Saved calendar plan ready" : planHint,
    focusLabel: state?.currentFocus ?? "Training rhythm",
    confidence: analytics.dataConfidence,
    hasSavedPlan: Boolean(savedPlan),
    savedPlanSummary: savedPlan?.summary ?? null,
  };
}

function buildBeliefFromAnalytics(analytics: DashboardInsights): string {
  const parts: string[] = [];
  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;

  if (r.label.toLowerCase().includes("ready") || r.score >= 85) {
    parts.push("Current belief: race readiness is strong");
  } else {
    parts.push(`Current belief: ${r.label.toLowerCase()} for goal fitness`);
  }

  if (analytics.fatigue.freshness >= 60) {
    parts.push("freshness supports quality work");
  } else if (analytics.fatigue.freshness < 45) {
    parts.push("freshness may suppress quality if load is maintained");
  }

  if (analytics.intensityAdvice.status === "too_hard") {
    parts.push("load composition may need easier spacing");
  } else if (analytics.efficiencySummary.trend === "improving") {
    parts.push("aerobic adaptation appears to be improving");
  }

  const vol = formatKm(analytics.summary.last7DaysKm);
  parts.push(`recent week ~${vol}`);

  return parts.join("; ") + ".";
}
