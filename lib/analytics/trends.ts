import type { RunActivity } from "@/lib/strava/types";
import { parseISO, format } from "date-fns";
import { paceSecPerKm } from "./pace";

export interface PaceTrendPoint {
  date: string;
  label: string;
  paceSecPerKm: number;
  distanceKm: number;
  name: string;
}

export interface RollingPacePoint {
  date: string;
  label: string;
  rollingPaceSecPerKm: number;
}

export function paceTrend(runs: RunActivity[]): PaceTrendPoint[] {
  return runs
    .map((r) => {
      const pace = paceSecPerKm(r);
      if (pace === null) return null;
      return {
        date: r.date,
        label: format(parseISO(r.date), "MMM d"),
        paceSecPerKm: pace,
        distanceKm: r.distanceM / 1000,
        name: r.name,
      };
    })
    .filter((p): p is PaceTrendPoint => p !== null);
}

export function rollingAveragePace(
  points: PaceTrendPoint[],
  window = 4
): RollingPacePoint[] {
  if (points.length < window) return [];
  const result: RollingPacePoint[] = [];
  for (let i = window - 1; i < points.length; i++) {
    const slice = points.slice(i - window + 1, i + 1);
    const avg =
      slice.reduce((s, p) => s + p.paceSecPerKm, 0) / slice.length;
    const last = slice[slice.length - 1];
    result.push({
      date: last.date,
      label: last.label,
      rollingPaceSecPerKm: avg,
    });
  }
  return result;
}

export interface HrTrendPoint {
  date: string;
  label: string;
  avgHr: number;
}

export function hrTrend(runs: RunActivity[]): HrTrendPoint[] {
  return runs
    .filter((r) => r.avgHr !== null)
    .map((r) => ({
      date: r.date,
      label: format(parseISO(r.date), "MMM d"),
      avgHr: r.avgHr!,
    }));
}
