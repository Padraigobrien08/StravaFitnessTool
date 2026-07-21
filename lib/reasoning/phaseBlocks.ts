import type { WorkoutType } from "@/lib/analytics/workoutType";
import { paceSecPerKm } from "@/lib/analytics/pace";
import { weeklyVolume } from "@/lib/analytics/volume";
import { format, parseISO, subWeeks } from "date-fns";
import type { PhaseBlockMetrics, ReasoningContext } from "./types";

const HARD_TYPES: WorkoutType[] = ["tempo", "interval", "race"];

export function buildPhaseBlocks(
  ctx: ReasoningContext,
  maxBlocks = 12
): PhaseBlockMetrics[] {
  const runs = ctx.runs;
  if (runs.length === 0) return [];

  const end = parseISO(runs[runs.length - 1].date);
  const blocks: PhaseBlockMetrics[] = [];

  for (let w = 0; w < maxBlocks; w++) {
    const blockEnd = subWeeks(end, w * 4);
    const blockStart = subWeeks(blockEnd, 4);
    const inBlock = runs.filter((r) => {
      const d = parseISO(r.date);
      return d > blockStart && d <= blockEnd;
    });
    if (inBlock.length === 0) continue;

    const distanceKm =
      Math.round(inBlock.reduce((s, r) => s + r.distanceM / 1000, 0) * 10) / 10;
    const longestRunKm =
      Math.round(Math.max(...inBlock.map((r) => r.distanceM)) / 100) / 10;
    const longRunPctOfVolume =
      distanceKm > 0
        ? Math.round((longestRunKm / distanceKm) * 1000) / 10
        : 0;

    let hardCount = 0;
    for (const r of inBlock) {
      const type = ctx.labelByRunId.get(r.id)?.type ?? "unknown";
      if (HARD_TYPES.includes(type)) hardCount++;
    }
    const hardPct =
      inBlock.length > 0
        ? Math.round((hardCount / inBlock.length) * 1000) / 10
        : 0;

    const efficiencies: number[] = [];
    for (const r of inBlock) {
      const pace = paceSecPerKm(r);
      if (pace != null && r.avgHr != null && r.avgHr >= 80) {
        efficiencies.push(Math.round((pace / r.avgHr) * 1000) / 1000);
      }
    }
    const meanEfficiency =
      efficiencies.length > 0
        ? Math.round(
            (efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length) * 1000
          ) / 1000
        : null;

    const weeksInBlock = weeklyVolume(inBlock);
    const kmValues = weeksInBlock.map((w) => w.distanceKm);
    const weeklyKmVariance =
      kmValues.length >= 2
        ? Math.round(
            (Math.max(...kmValues) - Math.min(...kmValues)) * 10
          ) / 10
        : 0;

    const hardBandScore =
      hardPct >= 15 && hardPct <= 25 ? 1 : hardPct < 15 ? 0.6 : 0.4;
    const effScore =
      meanEfficiency != null
        ? Math.max(0, 1 - meanEfficiency * 100)
        : 0.5;
    const aerobicScore = Math.round(
      (hardBandScore * 0.4 + effScore * 0.6) * 100
    );

    blocks.unshift({
      label: `${format(blockStart, "MMM d")} – ${format(blockEnd, "MMM d")}`,
      weekStart: blockStart.toISOString(),
      weekEnd: blockEnd.toISOString(),
      distanceKm,
      runCount: inBlock.length,
      runsPerWeek: Math.round((inBlock.length / 4) * 10) / 10,
      hardPct,
      longestRunKm,
      longRunPctOfVolume,
      meanEfficiency,
      weeklyKmVariance,
      aerobicScore,
    });
  }

  return blocks.slice(-maxBlocks);
}

export function currentPhaseBlock(blocks: PhaseBlockMetrics[]): PhaseBlockMetrics | null {
  return blocks.at(-1) ?? null;
}
