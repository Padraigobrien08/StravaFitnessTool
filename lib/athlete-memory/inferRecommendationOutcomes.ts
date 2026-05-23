import type { DashboardInsights } from "@/lib/analytics";
import type { RecommendationOutcome } from "./types";

/** Placeholder outcomes from deterministic plan + intensity advice until explicit tracking exists. */
export function inferRecommendationOutcomes(
  analytics: DashboardInsights
): RecommendationOutcome[] {
  const out: RecommendationOutcome[] = [];
  const now = new Date().toISOString();

  if (analytics.intensityAdvice.recommendations[0]) {
    out.push({
      recommendationId: "intensity-advice-current",
      recommendation: analytics.intensityAdvice.recommendations[0],
      issuedAt: now,
      expectedOutcome: "Better easy/hard balance and improved freshness",
      status: "pending",
      evidence: [
        `Easy ${Math.round(analytics.intensityAdvice.currentEasyPct)}% vs target ${analytics.intensityAdvice.easyTargetPct}%`,
      ],
    });
  }

  if (analytics.nextWeekPlan.rationale[0]) {
    out.push({
      recommendationId: `week-plan-${analytics.nextWeekPlan.weekStart}`,
      recommendation: analytics.nextWeekPlan.template,
      issuedAt: now,
      expectedOutcome: analytics.nextWeekPlan.rationale[0],
      status: "pending",
      evidence: analytics.nextWeekPlan.warnings.slice(0, 2),
    });
  }

  return out;
}
