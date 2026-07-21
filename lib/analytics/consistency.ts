import type { RunActivity } from "@/lib/strava/types";
import type { GoalProgress } from "./goals";
import { weeklyVolume } from "./volume";
import { startOfWeek, format } from "date-fns";

export interface ConsistencyScore {
  overall: number;
  label: string;
  frequency: number;
  volumeStability: number;
  streakWeeks: number;
  evidence: string[];
}

export function weeklyRunStreak(runs: RunActivity[]): number {
  const weeks = weeklyVolume(runs);
  if (weeks.length === 0) return 0;

  let streak = 0;
  const sorted = [...weeks].sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart)
  );
  const now = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentKey = format(now, "yyyy-MM-dd");

  for (const w of sorted) {
    if (w.weekStart > currentKey) continue;
    if (w.runCount >= 1) streak += 1;
    else break;
  }
  return Math.min(streak, 8);
}

export function volumeStabilityScore(
  weeks: ReturnType<typeof weeklyVolume>
): number {
  const recent = weeks.slice(-8);
  if (recent.length < 2) return 50;

  const kms = recent.map((w) => w.distanceKm);
  const mean = kms.reduce((a, b) => a + b, 0) / kms.length;
  if (mean === 0) return 0;

  const variance =
    kms.reduce((s, k) => s + (k - mean) ** 2, 0) / kms.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.round(Math.max(0, 100 - Math.min(100, cv * 200)));
}

export function frequencyScore(
  weeks: ReturnType<typeof weeklyVolume>,
  targetPerWeek: number
): number {
  const recent = weeks.slice(-8);
  if (recent.length === 0) return 0;
  const met = recent.filter((w) => w.runCount >= targetPerWeek).length;
  return Math.round((met / recent.length) * 100);
}

export function buildConsistencyScore(
  runs: RunActivity[],
  goalProgress: GoalProgress | null,
  defaultWeeklyRuns = 3
): ConsistencyScore {
  const weeks = weeklyVolume(runs);
  const target = goalProgress?.targetPerWeek ?? defaultWeeklyRuns;
  const frequency = frequencyScore(weeks, target);
  const volumeStability = volumeStabilityScore(weeks);
  const streakWeeks = weeklyRunStreak(runs);
  const streakComponent = Math.min(100, Math.round(streakWeeks * 12.5));

  const overall = Math.round(
    frequency * 0.4 + volumeStability * 0.3 + streakComponent * 0.3
  );

  let label = "Irregular";
  if (overall >= 75) label = "Steady";
  else if (overall >= 50) label = "Building";

  const evidence = [
    `Frequency: ${frequency}/100 (${target}+ runs/week in ${Math.min(8, weeks.length)} recent weeks).`,
    `Volume stability: ${volumeStability}/100 (lower week-to-week swing = higher score).`,
    `Active streak: ${streakWeeks} week${streakWeeks === 1 ? "" : "s"} with at least one run.`,
  ];

  return {
    overall,
    label,
    frequency,
    volumeStability,
    streakWeeks,
    evidence,
  };
}
