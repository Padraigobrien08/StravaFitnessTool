import type {
  RecommendationIntegrityReport,
  RecommendationIssue,
  WeeklyPlanIntegrityInput,
} from "./types";
import { runEvidenceChecks } from "./evidenceChecks";
import { runContradictionChecks } from "./contradictionChecks";
import { runSafetyChecks } from "./safetyChecks";
import { runConfidenceCalibration } from "./confidenceCalibration";

function scoreFromIssues(issues: RecommendationIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "high") score -= 25;
    else if (issue.severity === "medium") score -= 12;
    else score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}

function aggregateSeverity(
  issues: RecommendationIssue[]
): RecommendationIntegrityReport["severity"] {
  if (issues.some((i) => i.severity === "high")) return "high";
  if (issues.some((i) => i.severity === "medium")) return "medium";
  if (issues.length > 0) return "low";
  return "none";
}

export function evaluateWeeklyPlan(
  input: WeeklyPlanIntegrityInput
): RecommendationIntegrityReport {
  const issues: RecommendationIssue[] = [
    ...runEvidenceChecks(input),
    ...runContradictionChecks(input),
    ...runSafetyChecks(input),
    ...runConfidenceCalibration(input),
  ];

  const score = scoreFromIssues(issues);
  const severity = aggregateSeverity(issues);
  const hasHigh = issues.some((i) => i.severity === "high");
  const passed = !hasHigh && score >= 60;

  const requiredFixes = issues
    .filter((i) => i.severity === "high" || i.severity === "medium")
    .map((i) => i.suggestedFix);

  const warnings = issues
    .filter((i) => i.severity === "low")
    .map((i) => i.message);

  return {
    passed,
    score,
    severity,
    issues,
    requiredFixes: [...new Set(requiredFixes)],
    warnings,
  };
}
