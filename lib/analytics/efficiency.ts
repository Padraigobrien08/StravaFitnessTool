import type { RunActivity } from "@/lib/strava/types";
import { parseISO, format } from "date-fns";
import { paceSecPerKm } from "./pace";

/** Lower = more efficient (faster at same HR). Uses pace / HR as a simple index. */
export interface EfficiencyPoint {
  date: string;
  label: string;
  runName: string;
  efficiency: number;
  avgHr: number;
  paceSecPerKm: number;
}

export function aerobicEfficiencyTrend(runs: RunActivity[]): EfficiencyPoint[] {
  return runs
    .map((r) => {
      const pace = paceSecPerKm(r);
      if (pace === null || r.avgHr === null || r.avgHr < 80) return null;
      return {
        date: r.date,
        label: format(parseISO(r.date), "MMM d"),
        runName: r.name,
        efficiency: Math.round((pace / r.avgHr) * 1000) / 1000,
        avgHr: r.avgHr,
        paceSecPerKm: pace,
      };
    })
    .filter((p): p is EfficiencyPoint => p !== null);
}

export function efficiencySummary(points: EfficiencyPoint[]): {
  latest: number | null;
  trend: "improving" | "declining" | "stable" | null;
} {
  if (points.length < 4) return { latest: points.at(-1)?.efficiency ?? null, trend: null };
  const recent = points.slice(-4).map((p) => p.efficiency);
  const older = points.slice(-8, -4).map((p) => p.efficiency);
  if (older.length < 2) return { latest: recent.at(-1) ?? null, trend: null };
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const delta = recentAvg - olderAvg;
  let trend: "improving" | "declining" | "stable" = "stable";
  if (delta < -0.002) trend = "improving";
  else if (delta > 0.002) trend = "declining";
  return { latest: recent.at(-1) ?? null, trend };
}

export interface EfficiencyMonthOverMonth {
  currentMonth: string | null;
  priorMonth: string | null;
  pctChange: number | null;
  narrative: string | null;
  comparableCount: number;
}

export function comparableEffortSubset(
  points: EfficiencyPoint[],
  athleteMaxHr: number,
  minPct = 0.7,
  maxPct = 0.82
): EfficiencyPoint[] {
  return points.filter((p) => {
    const pct = p.avgHr / athleteMaxHr;
    return pct >= minPct && pct <= maxPct;
  });
}

export function efficiencyMonthOverMonth(
  points: EfficiencyPoint[]
): EfficiencyMonthOverMonth {
  const byMonth = new Map<string, number[]>();
  for (const p of points) {
    const key = format(parseISO(p.date), "yyyy-MM");
    const arr = byMonth.get(key) ?? [];
    arr.push(p.efficiency);
    byMonth.set(key, arr);
  }

  const months = [...byMonth.keys()].sort();
  if (months.length < 2) {
    return {
      currentMonth: months.at(-1) ?? null,
      priorMonth: null,
      pctChange: null,
      narrative: null,
      comparableCount: points.length,
    };
  }

  const currentMonth = months.at(-1)!;
  const priorMonth = months.at(-2)!;
  const currentRuns = byMonth.get(currentMonth) ?? [];
  const priorRuns = byMonth.get(priorMonth) ?? [];

  if (currentRuns.length < 2 || priorRuns.length < 2) {
    return {
      currentMonth,
      priorMonth,
      pctChange: null,
      narrative: null,
      comparableCount: points.length,
    };
  }

  const currentAvg =
    currentRuns.reduce((a, b) => a + b, 0) / currentRuns.length;
  const priorAvg = priorRuns.reduce((a, b) => a + b, 0) / priorRuns.length;
  const pctChange =
    priorAvg !== 0
      ? Math.round(((priorAvg - currentAvg) / priorAvg) * 100)
      : null;

  const currentLabel = format(parseISO(`${currentMonth}-01`), "MMMM");
  const priorLabel = format(parseISO(`${priorMonth}-01`), "MMMM");

  let narrative: string | null = null;
  if (pctChange !== null && pctChange > 2) {
    narrative = `Your aerobic efficiency is improving: you're running faster at similar heart rates compared with ${priorLabel} (${pctChange}% better index in ${currentLabel}).`;
  } else if (pctChange !== null && pctChange < -2) {
    narrative = `Efficiency dipped vs ${priorLabel} — fatigue, heat, or harder sessions may explain it.`;
  }

  return {
    currentMonth,
    priorMonth,
    pctChange,
    narrative,
    comparableCount: points.length,
  };
}
