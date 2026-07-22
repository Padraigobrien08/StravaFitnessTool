import type {
  RecommendationIntegrityReport,
  RecommendationIssue,
  RecommendationIntegrityInput,
} from "./types";
import { buildAllowedEvidenceTokens } from "./contextEvidence";

const MEDICAL_PATTERNS = [
  /\bdiagnos(e|is|ed)\b/i,
  /\bprescri(be|ption)\b/i,
  /\bmedically ready\b/i,
  /\bguarantee(d)?\b.*\binjur/i,
];

const INVENTED = [/\bhrv\b/i, /\bvo2\s*max\s*=\s*\d+/i];

export function evaluateRecommendation(
  input: RecommendationIntegrityInput,
): RecommendationIntegrityReport {
  const issues: RecommendationIssue[] = [];
  const text = input.text;
  const allowed = buildAllowedEvidenceTokens(input.context);

  for (const p of MEDICAL_PATTERNS) {
    if (p.test(text)) {
      issues.push({
        type: "medical_claim",
        severity: "high",
        message: "Recommendation may include medical certainty",
        suggestedFix: "Remove diagnosis or medical readiness claims",
      });
      break;
    }
  }

  for (const p of INVENTED) {
    if (p.test(text) && ![...allowed].some((t) => t.includes("hrv"))) {
      issues.push({
        type: "unsupported_claim",
        severity: "high",
        message: "Recommendation references metrics not in context",
        suggestedFix: "Remove invented biometrics",
      });
      break;
    }
  }

  if (input.claimedConfidence === "high" && input.context.dataQuality.hrCoverage === "low") {
    issues.push({
      type: "overconfidence",
      severity: "high",
      message: "High confidence claim with low HR coverage",
      suggestedFix: "Lower stated confidence",
    });
  }

  let score = 100;
  for (const i of issues) {
    if (i.severity === "high") score -= 25;
    else if (i.severity === "medium") score -= 12;
    else score -= 5;
  }
  score = Math.max(0, Math.min(100, score));

  const severity = issues.some((i) => i.severity === "high")
    ? "high"
    : issues.some((i) => i.severity === "medium")
      ? "medium"
      : issues.length
        ? "low"
        : "none";

  return {
    passed: !issues.some((i) => i.severity === "high") && score >= 60,
    score,
    severity,
    issues,
    requiredFixes: issues.map((i) => i.suggestedFix),
    warnings: [],
  };
}
