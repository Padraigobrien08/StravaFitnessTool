import { formatLongRunVsRace } from "@/lib/analytics/readiness";
import type { RaceForecastInput } from "./forecastTypes";
import type { DurabilityAssessment } from "./forecastTypes";

export function assessDurability(input: RaceForecastInput): DurabilityAssessment {
  const targetKm = input.goal.distanceMeters / 1000;
  const blocks = input.recentBlocks;
  const runs = input.runs;

  const longestKm = runs.reduce(
    (m, r) => Math.max(m, (r.distanceMeters ?? 0) / 1000),
    blocks[blocks.length - 1]?.longestRunKm ?? 0
  );

  const longestPct = targetKm > 0 ? (longestKm / targetKm) * 100 : 0;
  const recent = blocks[blocks.length - 1];
  const prior = blocks[blocks.length - 2];

  const evidence: string[] = [];
  const penalties: string[] = [];
  let score = 70;

  evidence.push(`Longest recent run ${formatLongRunVsRace(longestKm, targetKm)}.`);

  if (longestPct >= 98) {
    score += 18;
    evidence.push("Long-run distance closely matches race distance.");
  } else if (longestPct >= 75) {
    score += 10;
  } else if (longestPct >= 55) {
    score += 0;
    penalties.push("Long run supports shorter race distance but not full race length.");
  } else {
    score -= 22;
    penalties.push("Long-run support is limited for this race distance.");
  }

  if (recent && recent.runCount >= 3) {
    score += 6;
    evidence.push(`${recent.runCount} runs in recent block — rhythm maintained.`);
  } else if (recent && recent.runCount <= 1) {
    score -= 8;
    penalties.push("Sparse run frequency in recent block.");
  }

  if (prior && recent) {
    const volDelta = recent.distanceKm - prior.distanceKm;
    if (volDelta < -15 && targetKm >= 21) {
      score += 4;
      evidence.push("Volume taper may support race-day durability.");
    } else if (volDelta > 25 && longestPct < 70) {
      score -= 6;
      penalties.push("Volume jumped without proportional long-run growth.");
    }
  }

  const longRuns4wk = blocks.slice(-1).reduce((n, b) => {
    return n + (b.longestRunKm >= targetKm * 0.5 ? 1 : 0);
  }, 0);
  if (longRuns4wk === 0 && targetKm >= 21) {
    score -= 12;
    penalties.push("No long run ≥50% of race distance in latest block.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label: DurabilityAssessment["label"] = "moderate";
  if (score >= 72) label = "strong";
  else if (score < 48) label = "weak";

  const timeMultiplier =
    label === "strong" ? 1 : label === "moderate" ? 1 + (72 - score) * 0.0012 : 1 + (72 - score) * 0.002;

  const explanation =
    label === "strong"
      ? "Recent long-run support suggests you can sustain projected capability over race distance."
      : label === "moderate"
        ? "Partial long-run support — forecast may need modest durability discount."
        : "Limited long-run evidence — sustaining race distance is a primary uncertainty.";

  return {
    score,
    label,
    evidence,
    penalties,
    explanation,
    timeMultiplier,
  };
}
