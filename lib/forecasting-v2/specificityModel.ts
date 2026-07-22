import { distanceRelevanceWeight } from "./capabilityModels";
import type { RaceForecastInput } from "./forecastTypes";
import type { SpecificityAssessment } from "./forecastTypes";

export function assessSpecificity(input: RaceForecastInput): SpecificityAssessment {
  const targetKm = input.goal.distanceMeters / 1000;
  const efforts = input.efforts;
  const blocks = input.recentBlocks;
  const evidence: string[] = [];
  const gaps: string[] = [];
  let score = 50;

  const relevantEfforts = efforts.filter(
    (e) => distanceRelevanceWeight(e.distanceKm, targetKm) >= 0.55,
  );
  if (relevantEfforts.length >= 3) {
    score += 22;
    evidence.push(`${relevantEfforts.length} efforts within relevant distance band for target.`);
  } else if (relevantEfforts.length === 0) {
    score -= 25;
    gaps.push("No race-quality efforts near target distance.");
  } else {
    score += 8;
    gaps.push("Limited target-distance race efforts — extrapolation dominates.");
  }

  const recentVol = blocks[blocks.length - 1]?.distanceKm ?? 0;
  const targetVol = targetKm >= 35 ? 200 : targetKm >= 18 ? 140 : targetKm >= 9 ? 55 : 35;
  const volRatio = targetVol > 0 ? recentVol / targetVol : 0;
  if (volRatio >= 0.75 && volRatio <= 1.25) {
    score += 14;
    evidence.push("Recent block volume aligns with target-distance training.");
  } else if (volRatio < 0.5) {
    score -= 10;
    gaps.push("Recent volume below typical target-specific block.");
  }

  const longest = blocks[blocks.length - 1]?.longestRunKm ?? 0;
  if (longest >= targetKm * 0.85) {
    score += 12;
    evidence.push("Long-run length is race-specific.");
  } else if (longest < targetKm * 0.45 && targetKm >= 18) {
    score -= 18;
    gaps.push("Long runs do not yet approach race distance.");
  }

  const nearRaceEfforts = efforts.filter((e) => e.distanceKm >= targetKm * 0.9);
  if (nearRaceEfforts.length > 0) {
    score += 28;
    evidence.push(
      `${nearRaceEfforts.length} effort(s) at or near race distance (≥90% of ${targetKm.toFixed(1)} km).`,
    );
  }

  const maxAnchor = efforts.reduce((m, e) => Math.max(m, e.distanceKm), 0);
  if (maxAnchor < targetKm * 0.35 && targetKm >= 15) {
    score -= 15;
    gaps.push(
      `Strong short-distance anchors (${maxAnchor.toFixed(1)} km max) predicting ${targetKm.toFixed(1)} km.`,
    );
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label: SpecificityAssessment["label"] = "moderate";
  if (score >= 70) label = "high";
  else if (score < 45) label = "low";

  const timeMultiplier =
    label === "high" ? 1 : label === "moderate" ? 1.02 : 1 + (50 - score) * 0.003;

  return {
    score,
    label,
    evidence,
    gaps,
    timeMultiplier,
  };
}
