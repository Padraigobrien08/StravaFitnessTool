import type { Insight } from "@/lib/insights/types";
import type { EcosystemInsight, TrainingEcosystemAnalysis } from "./types";

export function ecosystemInsightsToCoachInsights(
  ecosystem: TrainingEcosystemAnalysis | null
): Insight[] {
  if (!ecosystem) return [];
  return ecosystem.ecosystemInsights.map((e) => ({
    id: `eco-${e.id}`,
    question:
      e.category === "interference_risk" || e.category === "hybrid_load"
        ? "training"
        : e.category === "recovery_behavior"
          ? "training"
          : "training",
    title: e.title,
    severity: e.severity,
    evidence: [
      ...e.evidence,
      `Confidence: ${e.confidence}. ${e.limitations[0] ?? ""}`,
    ].filter(Boolean),
    recommendation: e.recommendation,
    confidence: e.confidence,
  }));
}

/** One-line headline for home dashboard */
export function ecosystemHeadline(
  ecosystem: TrainingEcosystemAnalysis | null
): string | null {
  if (!ecosystem) return null;
  const hi = ecosystem.interferenceFlags.filter(
    (f) => f.severity !== "low" && f.kind === "near_quality_run"
  );
  if (hi.length > 0) {
    const s =
      ecosystem.scores.strengthSupport >= 60
        ? "Strength support is consistent, but "
        : "";
    return `${s}${hi[0].message}`;
  }
  const insight = ecosystem.ecosystemInsights.find(
    (i) => i.severity === "positive"
  );
  if (insight) return insight.title;
  if (ecosystem.totalContext.last28Days.nonRunSessions === 0) return null;
  return ecosystem.totalContext.headline;
}

export function generateEcosystemInsights(
  ecosystem: TrainingEcosystemAnalysis | null
): Insight[] {
  return ecosystemInsightsToCoachInsights(ecosystem);
}

export type { EcosystemInsight };
