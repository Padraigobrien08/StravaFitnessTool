import { buildReasoningContext } from "@/lib/reasoning/context";
import { findBestPhase } from "@/lib/reasoning/bestPhase";
import type { AthleteIntelligenceBundle } from "@/lib/intelligence/types";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { LongitudinalComparison } from "./types";

export function compareCurrentToStrongestBlock(
  bundle: AthleteIntelligenceBundle,
  raceGoal: RaceGoal | null,
): LongitudinalComparison | null {
  const ctx = buildReasoningContext(bundle, raceGoal);
  const result = findBestPhase(ctx, { metric: "aerobic" });
  const current = result.payload.current;
  const best = result.payload.best;

  if (!current || !best || best.label === "N/A") return null;

  const hardDelta = current.hardPct - best.hardPct;
  const volDelta = current.distanceKm - best.distanceKm;

  let summary = result.payload.comparison;
  if (hardDelta > 5 && volDelta < 0) {
    summary =
      "This block resembles your strongest aerobic phase in quality but carries higher intensity density at lower volume.";
  } else if (volDelta > 5 && hardDelta <= 0) {
    summary =
      "Current block volume exceeds your best aerobic phase with similar or lower intensity density.";
  }

  return {
    id: "block-vs-best",
    title: "Current block vs strongest block",
    summary,
    currentLabel: current.label,
    referenceLabel: best.label,
    evidence: result.evidence,
    confidence: result.confidence,
  };
}

export function compareTaperToHistory(
  bundle: AthleteIntelligenceBundle,
  _raceGoal: RaceGoal | null,
): LongitudinalComparison | null {
  const analytics = bundle.analytics;
  const r = analytics.raceReadiness;
  if (!r || r.daysUntilRace > 21) return null;

  const freshness = analytics.fatigue.freshness;
  const summary =
    freshness >= 55
      ? "Current taper appears to be preserving freshness more effectively than typical build weeks."
      : "Taper is active but freshness has not clearly rebounded yet: monitor easy density.";

  return {
    id: "taper-vs-history",
    title: "Taper response",
    summary,
    currentLabel: `Race −${r.daysUntilRace}d`,
    referenceLabel: "Prior build phase",
    evidence: [`Freshness ${Math.round(freshness)}`, `TSB ${Math.round(analytics.fatigue.tsb)}`],
    confidence: r.daysUntilRace <= 10 ? "medium" : "low",
  };
}

export function buildLongitudinalComparisons(
  bundle: AthleteIntelligenceBundle,
  raceGoal: RaceGoal | null,
): LongitudinalComparison[] {
  const out: LongitudinalComparison[] = [];
  const block = compareCurrentToStrongestBlock(bundle, raceGoal);
  if (block) out.push(block);
  const taper = compareTaperToHistory(bundle, raceGoal);
  if (taper) out.push(taper);
  return out;
}
