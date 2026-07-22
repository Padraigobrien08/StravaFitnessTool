import { differenceInCalendarDays, parseISO } from "date-fns";
import { RACE_READINESS_CONFIG, type RaceGoal } from "@/lib/analytics/readiness";
import type { CoachingGoalContext, GoalPriority } from "./types";

function inferPriority(daysUntil?: number): GoalPriority {
  if (daysUntil != null && daysUntil <= 21) return "high";
  if (daysUntil != null && daysUntil <= 56) return "medium";
  return "low";
}

export function buildGoalContext(
  goal: RaceGoal | null | undefined,
): CoachingGoalContext | undefined {
  if (!goal) return undefined;

  const cfg = RACE_READINESS_CONFIG[goal.distance];
  const raceDate = goal.date?.slice(0, 10);
  const daysUntilRace =
    raceDate != null ? differenceInCalendarDays(parseISO(raceDate), new Date()) : undefined;

  return {
    raceType: cfg.label,
    distanceMeters: Math.round(cfg.raceDistanceKm * 1000),
    raceDate,
    daysUntilRace: daysUntilRace != null && daysUntilRace >= 0 ? daysUntilRace : undefined,
    targetTimeSec: goal.targetTimeSec,
    priority: inferPriority(daysUntilRace),
  };
}
