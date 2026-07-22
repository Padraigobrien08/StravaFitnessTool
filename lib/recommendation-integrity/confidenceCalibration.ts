import type { RecommendationIssue, WeeklyPlanIntegrityInput } from "./types";
import type { PlanConfidence } from "@/lib/ai-planning/types";

const CONFIDENCE_RANK: Record<PlanConfidence, number> = {
  low: 0,
  medium: 1,
  medium_high: 2,
  high: 3,
};

function maxAllowedConfidence(context: WeeklyPlanIntegrityInput["context"]): PlanConfidence {
  const { dataQuality, currentState, goal } = context;
  let cap: PlanConfidence = "high";

  if (dataQuality.hrCoverage === "low" || dataQuality.activityCount < 6) {
    cap = "low";
  } else if (
    dataQuality.streamCoverage === "low" ||
    dataQuality.confidenceLimitations.length >= 3
  ) {
    cap = "medium";
  }

  if (currentState.fatigueState === "fatigued" || currentState.fatigueState === "unknown") {
    if (CONFIDENCE_RANK[cap] > CONFIDENCE_RANK.medium) cap = "medium";
  }

  if (goal && currentState.specificity === "low") {
    if (CONFIDENCE_RANK[cap] > CONFIDENCE_RANK.medium_high) cap = "medium_high";
  }

  if (!goal && cap === "high") {
    cap = "medium_high";
  }

  return cap;
}

export function runConfidenceCalibration(input: WeeklyPlanIntegrityInput): RecommendationIssue[] {
  const { plan, context } = input;
  const issues: RecommendationIssue[] = [];
  const cap = maxAllowedConfidence(context);

  if (CONFIDENCE_RANK[plan.confidence] > CONFIDENCE_RANK[cap]) {
    issues.push({
      type: "overconfidence",
      severity: cap === "low" ? "high" : "medium",
      message: `Plan confidence "${plan.confidence}" exceeds evidence cap "${cap}"`,
      suggestedFix: `Set confidence to ${cap} or lower and note data limitations`,
    });
  }

  if (plan.confidence === "high" && !plan.limitations.some((l) => l.length > 12)) {
    issues.push({
      type: "overconfidence",
      severity: "low",
      message: "High confidence without meaningful limitations stated",
      suggestedFix: "Add at least one limitation about data or individual response",
    });
  }

  return issues;
}

export { maxAllowedConfidence };
