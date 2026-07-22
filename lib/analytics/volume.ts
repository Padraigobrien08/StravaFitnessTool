import type { RunActivity } from "@/lib/strava/types";
import { startOfWeek, format, parseISO } from "date-fns";

export interface WeeklyVolume {
  weekStart: string;
  label: string;
  distanceKm: number;
  runCount: number;
}

export interface MonthlyVolume {
  month: string;
  label: string;
  distanceKm: number;
  runCount: number;
}

export function weeklyVolume(runs: RunActivity[]): WeeklyVolume[] {
  const map = new Map<string, WeeklyVolume>();

  for (const run of runs) {
    const d = parseISO(run.date);
    const ws = startOfWeek(d, { weekStartsOn: 1 });
    const key = format(ws, "yyyy-MM-dd");
    const existing = map.get(key) ?? {
      weekStart: key,
      label: format(ws, "MMM d"),
      distanceKm: 0,
      runCount: 0,
    };
    existing.distanceKm += run.distanceM / 1000;
    existing.runCount += 1;
    map.set(key, existing);
  }

  return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function monthlyVolume(runs: RunActivity[]): MonthlyVolume[] {
  const map = new Map<string, MonthlyVolume>();

  for (const run of runs) {
    const d = parseISO(run.date);
    const key = format(d, "yyyy-MM");
    const existing = map.get(key) ?? {
      month: key,
      label: format(d, "MMM yyyy"),
      distanceKm: 0,
      runCount: 0,
    };
    existing.distanceKm += run.distanceM / 1000;
    existing.runCount += 1;
    map.set(key, existing);
  }

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function lastNDaysVolume(
  runs: RunActivity[],
  days: number,
): { distanceKm: number; runCount: number } {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = runs.filter((r) => new Date(r.date).getTime() >= cutoff);
  return {
    distanceKm: recent.reduce((s, r) => s + r.distanceM / 1000, 0),
    runCount: recent.length,
  };
}
