import type { RunActivity } from "@/lib/strava/types";
import { parseISO, format, subWeeks } from "date-fns";

export interface TrainingBlock {
  weekStart: string;
  label: string;
  distanceKm: number;
  runCount: number;
  longestRunKm: number;
}

export function rollingFourWeekBlocks(runs: RunActivity[]): TrainingBlock[] {
  if (runs.length === 0) return [];

  const end = parseISO(runs[runs.length - 1].date);
  const blocks: TrainingBlock[] = [];

  for (let w = 0; w < 12; w++) {
    const blockEnd = subWeeks(end, w * 4);
    const blockStart = subWeeks(blockEnd, 4);
    const inBlock = runs.filter((r) => {
      const d = parseISO(r.date);
      return d > blockStart && d <= blockEnd;
    });
    if (inBlock.length === 0) continue;
    blocks.unshift({
      weekStart: blockStart.toISOString(),
      label: `${format(blockStart, "MMM d")} – ${format(blockEnd, "MMM d")}`,
      distanceKm: Math.round(inBlock.reduce((s, r) => s + r.distanceM / 1000, 0) * 10) / 10,
      runCount: inBlock.length,
      longestRunKm:
        Math.round(Math.max(...inBlock.map((r) => r.distanceM)) / 100) / 10,
    });
  }

  return blocks.slice(-6);
}

export function bestTrainingBlock(blocks: TrainingBlock[]): TrainingBlock | null {
  if (blocks.length === 0) return null;
  return [...blocks].sort((a, b) => b.distanceKm - a.distanceKm)[0];
}
