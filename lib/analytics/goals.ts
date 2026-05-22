import type { Goal, RunActivity } from "@/lib/strava/types";
import { startOfWeek, parseISO, isAfter, isBefore } from "date-fns";
import { weeklyVolume } from "./volume";

export interface GoalProgress {
  goalLabel: string;
  targetPerWeek: number;
  currentWeekRuns: number;
  met: boolean;
  weeksMet: number;
  weeksTotal: number;
  weeklyBreakdown: { week: string; runs: number; met: boolean }[];
}

export function runGoalProgress(
  runs: RunActivity[],
  goals: Goal[]
): GoalProgress | null {
  const runGoal = goals.find(
    (g) =>
      g.activityType.toLowerCase() === "run" &&
      g.type.toLowerCase() === "count" &&
      g.timePeriod.toLowerCase() === "week"
  );
  if (!runGoal) return null;

  const goalStart = new Date(runGoal.startDate.replace(/^"|"$/g, "").trim());
  if (Number.isNaN(goalStart.getTime())) {
    return null;
  }
  const weeks = weeklyVolume(
    runs.filter((r) => !isBefore(parseISO(r.date), goalStart))
  );

  const breakdown = weeks.map((w) => ({
    week: w.label,
    runs: w.runCount,
    met: w.runCount >= runGoal.target,
  }));

  const weeksMet = breakdown.filter((b) => b.met).length;
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekRuns = runs.filter((r) => {
    const d = parseISO(r.date);
    return (
      !isBefore(d, currentWeekStart) &&
      !isAfter(d, now) &&
      !isBefore(d, goalStart)
    );
  }).length;

  return {
    goalLabel: `${runGoal.target} runs / week`,
    targetPerWeek: runGoal.target,
    currentWeekRuns,
    met: currentWeekRuns >= runGoal.target,
    weeksMet,
    weeksTotal: breakdown.length,
    weeklyBreakdown: breakdown.slice(-8),
  };
}
