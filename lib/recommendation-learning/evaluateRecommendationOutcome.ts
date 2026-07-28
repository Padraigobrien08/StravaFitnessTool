import type {
  EvaluateOutcomeInput,
  OutcomeEvaluation,
  TrackedRecommendationOutcome,
} from "./types";

function textMatchesExpectation(
  expected: string[],
  signals: string[],
): { hits: number; misses: number } {
  const blob = signals.join(" ").toLowerCase();
  let hits = 0;
  let misses = 0;
  for (const e of expected) {
    const tokens = e
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 5);
    const match = tokens.some((t) => blob.includes(t));
    if (match) hits++;
    else misses++;
  }
  return { hits, misses };
}

export function evaluateRecommendationOutcome(
  input: EvaluateOutcomeInput,
): TrackedRecommendationOutcome {
  const { outcome } = input;
  const signals = [...outcome.observedSignals];
  const now = new Date().toISOString();

  if (input.freshness != null) {
    signals.push(`Freshness ${Math.round(input.freshness)}`);
  }
  if (input.tsb != null) {
    signals.push(`TSB ${input.tsb > 0 ? "+" : ""}${Math.round(input.tsb)}`);
  }
  if (input.readinessScore != null) {
    signals.push(`Readiness ${input.readinessScore}/100`);
  }
  if (input.legFeel) {
    signals.push(`Reported legs: ${input.legFeel}`);
  }
  if (input.readinessDelta != null && Math.abs(input.readinessDelta) >= 3) {
    signals.push(
      `Readiness ${input.readinessDelta > 0 ? "improved" : "declined"} ${Math.abs(input.readinessDelta)} pts`,
    );
  }
  if (input.efficiencyTrend === "improving") {
    signals.push("Aerobic efficiency improving");
  }
  if (input.efficiencyTrend === "declining") {
    signals.push("Aerobic efficiency declining");
  }
  if (input.hardRuns14d != null && input.priorHardRuns14d != null) {
    const d = input.hardRuns14d - input.priorHardRuns14d;
    if (d !== 0) {
      signals.push(`Hard-run density ${d > 0 ? "increased" : "decreased"}`);
    }
  }

  const rec = outcome.recommendation.toLowerCase();
  let evaluation: OutcomeEvaluation = "inconclusive";
  let confidenceAfter = outcome.confidenceBefore;

  const { hits, misses } = textMatchesExpectation(outcome.expectedOutcome, signals);

  const freshnessRecovered =
    /fresh|recovery|easy|taper/i.test(rec) && input.freshness != null && input.freshness >= 55;
  const freshnessSuppressed =
    /fresh|recovery|easy/i.test(rec) && input.freshness != null && input.freshness < 42;
  const intensityReduced =
    /intensity|hard|stack/i.test(rec) &&
    input.hardRuns14d != null &&
    input.priorHardRuns14d != null &&
    input.hardRuns14d < input.priorHardRuns14d;
  const intensityBackfired =
    /intensity|hard|stack/i.test(rec) &&
    input.freshness != null &&
    input.freshness < 40 &&
    input.hardRuns14d != null &&
    input.hardRuns14d >= (input.priorHardRuns14d ?? 0);

  if (freshnessRecovered || intensityReduced || (hits >= 2 && misses === 0)) {
    evaluation = hits >= 1 && misses > 0 ? "partially_supported" : "supported";
    confidenceAfter = Math.min(1, outcome.confidenceBefore + 0.15);
  } else if (freshnessSuppressed || intensityBackfired || misses >= 2) {
    evaluation = "contradicted";
    confidenceAfter = Math.max(0.1, outcome.confidenceBefore - 0.2);
  } else if (hits >= 1) {
    evaluation = "partially_supported";
    confidenceAfter = outcome.confidenceBefore;
  }

  if (signals.length < 2) {
    evaluation = "inconclusive";
    confidenceAfter = Math.max(0.2, outcome.confidenceBefore - 0.05);
  }

  return {
    ...outcome,
    observedSignals: [...new Set(signals)],
    evaluation,
    confidenceAfter,
    evaluatedAt: now,
  };
}

export function confidenceLabel(score: number): "low" | "medium" | "high" {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export function confidenceToScore(level: "low" | "medium" | "high"): number {
  if (level === "high") return 0.85;
  if (level === "medium") return 0.55;
  return 0.3;
}
