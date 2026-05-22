import type { RunActivity } from "@/lib/strava/types";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  format,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { paceSecPerKm } from "./pace";

export interface WeekSnapshot {
  weekStart: string;
  weekLabel: string;
  runCount: number;
  distanceKm: number;
  longestRunKm: number;
  easyCount: number;
  hardCount: number;
  avgPaceSecPerKm: number | null;
}

export interface WeekComparison {
  runCountDelta: number;
  distanceKmDelta: number;
  distancePctChange: number | null;
}

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekStartKey(date: Date): string {
  return format(getWeekStart(date), "yyyy-MM-dd");
}

export function runsInWeek(
  runs: RunActivity[],
  weekStart: Date
): RunActivity[] {
  const start = weekStart;
  const end = endOfWeek(weekStart, { weekStartsOn: 1 });
  return runs.filter((r) => {
    const d = parseISO(r.date);
    return isWithinInterval(d, { start, end });
  });
}

export function easyHardForWeek(
  runs: RunActivity[],
  weekStart: Date,
  athleteMaxHr: number
): { easy: number; hard: number } {
  const weekRuns = runsInWeek(runs, weekStart);
  let easy = 0;
  let hard = 0;
  for (const run of weekRuns) {
    if (run.avgHr === null) continue;
    const pct = run.avgHr / athleteMaxHr;
    if (pct < 0.8) easy += 1;
    else hard += 1;
  }
  return { easy, hard };
}

export function buildWeekSnapshot(
  runs: RunActivity[],
  weekStartDate: Date,
  athleteMaxHr: number
): WeekSnapshot {
  const weekRuns = runsInWeek(runs, weekStartDate);
  const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });
  const weekStart = getWeekStart(weekStartDate);

  let distanceKm = 0;
  let longestRunKm = 0;
  const paces: number[] = [];

  for (const run of weekRuns) {
    const km = run.distanceM / 1000;
    distanceKm += km;
    longestRunKm = Math.max(longestRunKm, km);
    const pace = paceSecPerKm(run);
    if (pace !== null) paces.push(pace);
  }

  const { easy, hard } = easyHardForWeek(runs, weekStartDate, athleteMaxHr);

  return {
    weekStart: format(weekStart, "yyyy-MM-dd"),
    weekLabel: `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d")}`,
    runCount: weekRuns.length,
    distanceKm: Math.round(distanceKm * 10) / 10,
    longestRunKm: Math.round(longestRunKm * 10) / 10,
    easyCount: easy,
    hardCount: hard,
    avgPaceSecPerKm:
      paces.length > 0
        ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length)
        : null,
  };
}

export function compareWeeks(
  current: WeekSnapshot,
  previous: WeekSnapshot | null
): WeekComparison {
  if (!previous) {
    return {
      runCountDelta: current.runCount,
      distanceKmDelta: current.distanceKm,
      distancePctChange: null,
    };
  }
  const distanceKmDelta = current.distanceKm - previous.distanceKm;
  const distancePctChange =
    previous.distanceKm > 0
      ? Math.round((distanceKmDelta / previous.distanceKm) * 100)
      : current.distanceKm > 0
        ? 100
        : 0;
  return {
    runCountDelta: current.runCount - previous.runCount,
    distanceKmDelta: Math.round(distanceKmDelta * 10) / 10,
    distancePctChange,
  };
}

export function buildCurrentAndPreviousWeek(
  runs: RunActivity[],
  athleteMaxHr: number,
  weekOffset = 0
): { current: WeekSnapshot; previous: WeekSnapshot | null } {
  const now = new Date();
  const targetWeek = subWeeks(getWeekStart(now), weekOffset);
  const prevWeek = subWeeks(targetWeek, 1);
  return {
    current: buildWeekSnapshot(runs, targetWeek, athleteMaxHr),
    previous: buildWeekSnapshot(runs, prevWeek, athleteMaxHr),
  };
}

export function maxLongestRunPriorWeeks(
  runs: RunActivity[],
  athleteMaxHr: number,
  beforeWeekStart: Date,
  weeks = 4
): number {
  let max = 0;
  for (let i = 1; i <= weeks; i++) {
    const ws = subWeeks(beforeWeekStart, i);
    const snap = buildWeekSnapshot(runs, ws, athleteMaxHr);
    max = Math.max(max, snap.longestRunKm);
  }
  return max;
}

export function runsInLastNDays(runs: RunActivity[], days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return runs.filter((r) => parseISO(r.date) >= cutoff).length;
}
