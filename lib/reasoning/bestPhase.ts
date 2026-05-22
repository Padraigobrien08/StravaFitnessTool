import { confidenceFromRuns } from "@/lib/intelligence/envelope";
import { buildPhaseBlocks, currentPhaseBlock } from "./phaseBlocks";
import type {
  BestPhaseMetric,
  FindBestPhaseArgs,
  PhaseBlockMetrics,
  ReasoningContext,
  ReasoningResult,
} from "./types";

function rankBlocks(
  blocks: PhaseBlockMetrics[],
  metric: BestPhaseMetric
): PhaseBlockMetrics[] {
  const copy = [...blocks];
  switch (metric) {
    case "volume":
      return copy.sort((a, b) => b.distanceKm - a.distanceKm);
    case "consistency":
      return copy.sort((a, b) => a.weeklyKmVariance - b.weeklyKmVariance);
    case "efficiency":
      return copy.sort((a, b) => {
        const ae = a.meanEfficiency ?? 999;
        const be = b.meanEfficiency ?? 999;
        return ae - be;
      });
    case "aerobic":
    default:
      return copy.sort((a, b) => b.aerobicScore - a.aerobicScore);
  }
}

export function findBestPhase(
  ctx: ReasoningContext,
  args: FindBestPhaseArgs = {}
): ReasoningResult<{
  metric: BestPhaseMetric;
  best: PhaseBlockMetrics;
  runnerUp: PhaseBlockMetrics | null;
  current: PhaseBlockMetrics | null;
  comparison: string;
}> {
  const metric = args.metric ?? "aerobic";
  const blocks = buildPhaseBlocks(ctx);
  const ranked = rankBlocks(blocks, metric);
  const best = ranked[0];
  const runnerUp = ranked[1] ?? null;
  const current = currentPhaseBlock(blocks);

  const limitations: string[] = [];
  if (blocks.length < 3) {
    limitations.push("Fewer than 3 four-week blocks — phase ranking has low confidence.");
  }
  if (metric === "efficiency" && blocks.every((b) => b.meanEfficiency == null)) {
    limitations.push("Insufficient HR+pace data for efficiency-based phase ranking.");
  }

  let comparison = "Not enough training history to compare phases.";
  if (best && current && best.label !== current.label) {
    const volDelta = current.distanceKm - best.distanceKm;
    comparison = `Current block (${current.label}): ${current.distanceKm} km, hard ${current.hardPct}%. Best ${metric} phase (${best.label}): ${best.distanceKm} km, hard ${best.hardPct}%. Volume vs best: ${volDelta >= 0 ? "+" : ""}${volDelta.toFixed(1)} km.`;
  } else if (best) {
    comparison = `Current block aligns with your strongest ${metric} phase (${best.label}).`;
  }

  const evidence = best
    ? [
        `Best ${metric} block: ${best.label} — ${best.distanceKm} km, ${best.runCount} runs, hard ${best.hardPct}%`,
        best.meanEfficiency != null
          ? `Mean aerobic efficiency index ${best.meanEfficiency}`
          : "Efficiency index unavailable for this block",
      ]
    : [];

  return {
    payload: {
      metric,
      best: best ?? {
        label: "N/A",
        weekStart: "",
        weekEnd: "",
        distanceKm: 0,
        runCount: 0,
        runsPerWeek: 0,
        hardPct: 0,
        longestRunKm: 0,
        longRunPctOfVolume: 0,
        meanEfficiency: null,
        weeklyKmVariance: 0,
        aerobicScore: 0,
      },
      runnerUp,
      current,
      comparison,
    },
    evidence,
    assumptions: [
      "Phases are rolling 4-week windows ending on your most recent run date.",
      metric === "aerobic"
        ? "Aerobic score favors moderate hard-day share (15–25%) and lower pace/HR index."
        : `Ranking by ${metric} only.`,
    ],
    limitations,
    confidence:
      blocks.length >= 6
        ? "high"
        : blocks.length >= 3
          ? "medium"
          : confidenceFromRuns(ctx.runs.length),
  };
}
