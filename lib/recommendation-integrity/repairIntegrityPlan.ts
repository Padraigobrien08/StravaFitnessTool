import { repairWeeklyPlan, stripMedicalLanguage } from "@/lib/ai-planning/repairWeeklyPlan";
import { maxAllowedConfidence } from "./confidenceCalibration";
import { buildAllowedEvidenceTokens } from "./contextEvidence";
import type { RecommendationIntegrityReport } from "./types";
import type { WeeklyPlanIntegrityInput } from "./types";
import type { WeeklyTrainingPlan } from "@/lib/ai-planning/types";

function defaultEvidence(context: WeeklyPlanIntegrityInput["context"]): string[] {
  const out: string[] = [];
  if (context.currentState.freshness != null) {
    out.push(`Freshness ~${Math.round(context.currentState.freshness)}`);
  }
  out.push(`Fatigue state: ${context.currentState.fatigueState}`);
  if (context.currentState.readiness != null) {
    out.push(`Readiness ${context.currentState.readiness}/100`);
  }
  const last = context.recentTraining.weeks.at(-1);
  if (last) {
    out.push(`Last week ~${last.runDistanceKm} km, ${last.hardRunCount} hard run(s)`);
  }
  if (context.athlete.knownPatterns[0]) {
    out.push(context.athlete.knownPatterns[0].summary);
  }
  for (const l of context.dataQuality.confidenceLimitations.slice(0, 2)) {
    out.push(l);
  }
  return out.filter(Boolean).slice(0, 5);
}

export function repairPlanFromIntegrity(
  plan: WeeklyTrainingPlan,
  input: WeeklyPlanIntegrityInput,
  report: RecommendationIntegrityReport,
): WeeklyTrainingPlan {
  let current = stripMedicalLanguage(plan);
  current = repairWeeklyPlan(current, input.guardrails);

  const cap = maxAllowedConfidence(input.context);
  if (report.issues.some((i) => i.type === "overconfidence") && current.confidence !== cap) {
    current = { ...current, confidence: cap };
  }

  const needsEvidence = report.issues.some(
    (i) => i.type === "missing_evidence" || i.type === "unsupported_claim",
  );
  if (needsEvidence) {
    const allowed = buildAllowedEvidenceTokens(input.context);
    const grounded = defaultEvidence(input.context);
    const kept = current.rationale.evidenceUsed.filter((e) => {
      const lower = e.toLowerCase();
      return [...allowed].some((t) => lower.includes(t) || t.includes(lower.slice(0, 10)));
    });
    current = {
      ...current,
      rationale: {
        ...current.rationale,
        evidenceUsed: [...new Set([...kept, ...grounded])].slice(0, 6),
      },
    };
  }

  const limitations = new Set(current.limitations);
  limitations.add("Plan adjusted for StrideIQ recommendation integrity (evidence and safety).");
  if (input.context.dataQuality.hrCoverage === "low") {
    limitations.add("Limited HR coverage — treat paces and load as approximate.");
  }
  if (report.issues.some((i) => i.type === "medical_claim")) {
    limitations.add("Not medical advice — consult a professional for injury or health concerns.");
  }

  current = {
    ...current,
    limitations: [...limitations].slice(0, 8),
  };

  return current;
}
