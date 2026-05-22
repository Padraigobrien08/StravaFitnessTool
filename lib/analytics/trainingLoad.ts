import type { RunActivity } from "@/lib/strava/types";
import { parseISO, format, startOfWeek } from "date-fns";

export interface LoadPoint {
  date: string;
  label: string;
  trainingLoad: number | null;
  relativeEffort: number | null;
}

export interface FitnessIndexPoint {
  weekStart: string;
  label: string;
  ctl: number;
}

/** Simple CTL-style EMA on weekly sum of training load */
export function fitnessIndex(
  runs: RunActivity[],
  tauWeeks = 6
): FitnessIndexPoint[] {
  const weekly = new Map<string, number>();
  for (const run of runs) {
    if (run.trainingLoad === null) continue;
    const d = parseISO(run.date);
    const key = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    weekly.set(key, (weekly.get(key) ?? 0) + run.trainingLoad);
  }

  const sorted = [...weekly.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const alpha = 2 / (tauWeeks + 1);
  let ctl = 0;
  const points: FitnessIndexPoint[] = [];

  for (const [weekStart, load] of sorted) {
    ctl = alpha * load + (1 - alpha) * ctl;
    points.push({
      weekStart,
      label: format(parseISO(weekStart), "MMM d"),
      ctl: Math.round(ctl),
    });
  }

  return points;
}

export function loadByRun(runs: RunActivity[]): LoadPoint[] {
  return runs
    .filter((r) => r.trainingLoad !== null || r.relativeEffort !== null)
    .map((r) => ({
      date: r.date,
      label: format(parseISO(r.date), "MMM d"),
      trainingLoad: r.trainingLoad,
      relativeEffort: r.relativeEffort,
    }));
}
