import type { RecommendationIssue } from "./types";
import type { WeeklyPlanIntegrityInput } from "./types";
import { buildAllowedEvidenceTokens, evidenceItemGrounded } from "./contextEvidence";

const INVENTED_METRIC_PATTERNS = [
  /\bhrv\b/i,
  /\bheart rate variability\b/i,
  /\bvo2\s*max\s*(is|at|=)\s*\d+/i,
  /\btsb\s*[=:]\s*-?\d+/i,
  /\bctl\s*[=:]\s*\d+/i,
  /\batl\s*[=:]\s*\d+/i,
  /\breadiness\s*(score)?\s*(is|at|=)\s*\d{2,3}\b/i,
  /\bfreshness\s*(is|at|=)\s*\d{2,3}\b/i,
  /\blactate\b/i,
];

const VAGUE_EVIDENCE = [
  /^recent training$/i,
  /^your data$/i,
  /^training history$/i,
  /^general fitness$/i,
  /^athlete context$/i,
];

function collectPlanText(plan: WeeklyPlanIntegrityInput["plan"]): string {
  return [
    plan.summary,
    plan.rationale.primaryGoal,
    ...plan.rationale.evidenceUsed,
    ...plan.rationale.tradeoffs,
    ...plan.rationale.risksManaged,
    ...plan.limitations,
    ...plan.workouts.flatMap((w) => [w.purpose, w.reasoning]),
  ].join("\n");
}

export function runEvidenceChecks(input: WeeklyPlanIntegrityInput): RecommendationIssue[] {
  const { plan, context } = input;
  const issues: RecommendationIssue[] = [];
  const allowed = buildAllowedEvidenceTokens(context);
  const text = collectPlanText(plan);

  if (!plan.rationale.evidenceUsed?.length) {
    issues.push({
      type: "missing_evidence",
      severity: "high",
      message: "Plan rationale has no evidenceUsed entries",
      suggestedFix: "Add 2–4 data-grounded evidence bullets from coaching context",
    });
    return issues;
  }

  const ungrounded: string[] = [];
  for (const item of plan.rationale.evidenceUsed) {
    if (VAGUE_EVIDENCE.some((p) => p.test(item.trim()))) {
      ungrounded.push(item);
      continue;
    }
    if (!evidenceItemGrounded(item, allowed)) {
      ungrounded.push(item);
    }
  }

  if (ungrounded.length >= plan.rationale.evidenceUsed.length) {
    issues.push({
      type: "missing_evidence",
      severity: "high",
      message: "Rationale evidence is generic or not tied to available analytics",
      evidence: ungrounded,
      suggestedFix:
        "Reference freshness, volume, readiness, intensity balance, or known patterns from context",
    });
  } else if (ungrounded.length > 0) {
    issues.push({
      type: "missing_evidence",
      severity: "medium",
      message: "Some rationale evidence is not clearly grounded in context",
      evidence: ungrounded,
      suggestedFix: "Replace vague evidence with specific metrics or patterns from context",
    });
  }

  if (plan.rationale.evidenceUsed.length < 2) {
    issues.push({
      type: "missing_evidence",
      severity: "medium",
      message: "Only one evidence item — plan may be under-justified",
      suggestedFix: "Add at least one more context-backed evidence point",
    });
  }

  for (const p of INVENTED_METRIC_PATTERNS) {
    if (p.test(text)) {
      const hasHrvInContext = [...allowed].some((t) => t.includes("hrv"));
      if (/\bhrv\b/i.test(text) && !hasHrvInContext) {
        issues.push({
          type: "unsupported_claim",
          severity: "high",
          message: "Plan references HRV or metrics not present in coaching context",
          suggestedFix:
            "Remove invented biometrics; use freshness, TSB label, or load narrative only",
        });
        break;
      }
      if (!/\bhrv\b/i.test(text)) {
        issues.push({
          type: "unsupported_claim",
          severity: "medium",
          message: "Plan may invent precise metrics not supplied in context",
          suggestedFix: "Use qualitative load/readiness language instead of exact invented numbers",
        });
        break;
      }
    }
  }

  const genericSummary =
    plan.summary.length < 40 || /^(build|maintain|train|work hard|get fit)/i.test(plan.summary);
  if (genericSummary && context.dataQuality.activityCount >= 8) {
    issues.push({
      type: "missing_evidence",
      severity: "low",
      message: "Plan summary is generic despite sufficient training history",
      suggestedFix: "Tie summary to goal phase, fatigue state, or recent block",
    });
  }

  return issues;
}
