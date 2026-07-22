import type { DashboardInsights } from "@/lib/analytics";
import type { TrackedRecommendationOutcome } from "./types";

export function buildOutcomeEvidenceFromAnalytics(
  analytics: DashboardInsights,
  prior?: { freshness?: number; tsb?: number; readiness?: number },
): string[] {
  const evidence: string[] = [];
  const f = analytics.fatigue.freshness;
  const tsb = analytics.fatigue.tsb;
  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;

  evidence.push(`Freshness ${Math.round(f)} (${analytics.fatigue.label})`);
  evidence.push(`TSB ${tsb > 0 ? "+" : ""}${Math.round(tsb)}`);

  if (prior?.freshness != null) {
    const delta = f - prior.freshness;
    evidence.push(
      `Freshness change ${delta >= 0 ? "+" : ""}${Math.round(delta)} vs prior snapshot`,
    );
  }
  if (prior?.readiness != null) {
    evidence.push(`Readiness ${r.score}/100 (was ${prior.readiness})`);
  } else {
    evidence.push(`Readiness ${r.score}/100 — ${r.label}`);
  }

  if (analytics.efficiencySummary.trend) {
    evidence.push(`Efficiency trend: ${analytics.efficiencySummary.trend}`);
  }

  evidence.push(
    `${analytics.intensityAdvice.hardRunsLast14d} hard runs / 14d · ${analytics.intensityAdvice.status}`,
  );

  return evidence;
}

export function mergeOutcomeEvidence(
  outcome: TrackedRecommendationOutcome,
  additional: string[],
): TrackedRecommendationOutcome {
  const seen = new Set<string>();
  const evidence: string[] = [];
  for (const e of [...outcome.evidence, ...additional]) {
    const k = e.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    evidence.push(e);
  }
  return { ...outcome, evidence: evidence.slice(0, 10) };
}
