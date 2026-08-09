import type { ForecastV2View } from "@/lib/goals/forecastV2ViewModel";
import type { CoachingForecastContext } from "./types";

function mapConfidence(label: string): CoachingForecastContext["confidence"] {
  const n = label.toLowerCase().replace(/\s+/g, "_");
  if (n === "medium-high" || n === "medium_high") return "medium_high";
  if (n === "high") return "high";
  if (n === "medium") return "medium";
  return "low";
}

export function buildForecastContext(
  view: ForecastV2View | null | undefined,
): CoachingForecastContext | undefined {
  if (!view?.enabled) return undefined;

  const raw = view.raw;
  const mostLikelyTimeSec = raw.mostLikelyTimeSec;
  const realisticRangeSec = {
    low: raw.predictionIntervalSec.innerLowSec,
    high: raw.predictionIntervalSec.innerHighSec,
  };

  return {
    mostLikelyTimeSec,
    realisticRangeSec,
    confidence: mapConfidence(view.confidence),
    positiveContributors: view.positiveContributors
      .slice(0, 4)
      .map((c) => `${c.label}: ${c.evidence}`),
    negativeContributors: view.negativeContributors
      .slice(0, 4)
      .map((c) => `${c.label}: ${c.evidence}`),
    uncertaintyDrivers: view.uncertaintyDrivers
      .slice(0, 5)
      .map((u) => `${u.label} (${u.impact}): ${u.explanation}`),
    recommendation: view.recommendation,
  };
}
