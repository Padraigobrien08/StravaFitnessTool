import { addWeeks, format, startOfWeek } from "date-fns";
import type { CoachingContext } from "@/lib/coaching-context";
import type { WeeklyPlanGuardrails, WeeklyPlanType } from "./types";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function nextPlanWeekStart(): string {
  const start = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
  return format(start, "yyyy-MM-dd");
}

function recentWeeklyRunKm(context: CoachingContext): number {
  const weeks = context.recentTraining.weeks;
  if (!weeks.length) return 0;
  const last = weeks[weeks.length - 1];
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : undefined;
  return last?.runDistanceKm ?? prev?.runDistanceKm ?? 0;
}

function inferPlanType(context: CoachingContext): WeeklyPlanType {
  const days = context.goal?.daysUntilRace;
  if (days != null && days <= 7 && days >= 0) return "race_week";
  if (days != null && days <= 14) return "taper";
  if (
    context.currentState.fatigueState === "fatigued" ||
    (context.currentState.freshness != null && context.currentState.freshness < 45)
  ) {
    return "recovery";
  }
  if (context.constraints.tapering) return "taper";
  if (!context.goal) return "maintain";
  if (days != null && days > 56) return "build";
  return "maintain";
}

export function computeWeeklyPlanGuardrails(
  context: CoachingContext
): WeeklyPlanGuardrails {
  const weekStart = nextPlanWeekStart();
  const daysUntilRace = context.goal?.daysUntilRace;
  const raceWeek =
    context.constraints.raceWeek ||
    (daysUntilRace != null && daysUntilRace <= 7 && daysUntilRace >= 0);
  const taperPhase =
    context.constraints.tapering ||
    (daysUntilRace != null && daysUntilRace <= 14 && daysUntilRace > 7);

  const planTypeHint = inferPlanType(context);
  const recentKm = recentWeeklyRunKm(context);
  const baselineKm = Math.max(recentKm, 15);

  let maxHardSessions =
    context.constraints.maxHardSessions ??
    (context.currentState.intensityBalance === "intensity_heavy" ? 1 : 2);

  if (raceWeek || (daysUntilRace != null && daysUntilRace <= 10)) {
    maxHardSessions = 1;
  }
  if (context.constraints.avoidIntensityStacking) {
    maxHardSessions = Math.min(maxHardSessions, 1);
  }
  if (context.currentState.fatigueState === "fatigued") {
    maxHardSessions = 0;
  }

  let maxVolumeIncreasePct = 10;
  if (planTypeHint === "build" && context.dataQuality.hrCoverage !== "low") {
    maxVolumeIncreasePct = 12;
  }
  if (taperPhase || raceWeek) {
    maxVolumeIncreasePct = -25;
  }
  if (planTypeHint === "recovery") {
    maxVolumeIncreasePct = -20;
  }

  let maxWeeklyRunKm = Math.round(
    Math.min(
      context.constraints.maxWeeklyVolumeKm ?? baselineKm * 1.15,
      baselineKm * (1 + maxVolumeIncreasePct / 100)
    ) * 10
  ) / 10;

  if (raceWeek && context.goal?.distanceMeters) {
    const raceKm = context.goal.distanceMeters / 1000;
    maxWeeklyRunKm = Math.round(
      Math.max(maxWeeklyRunKm, raceKm + 14) * 10
    ) / 10;
  }

  const minWeeklyRunKm =
    planTypeHint === "recovery"
      ? Math.round(baselineKm * 0.55 * 10) / 10
      : raceWeek
        ? Math.round(baselineKm * 0.35 * 10) / 10
        : Math.round(baselineKm * 0.7 * 10) / 10;

  let longRunMaxKm = raceWeek
    ? Math.min(8, baselineKm * 0.25)
    : taperPhase
      ? Math.min(14, baselineKm * 0.45)
      : Math.min(22, baselineKm * 0.55);

  if (raceWeek && context.goal?.distanceMeters) {
    longRunMaxKm = context.goal.distanceMeters / 1000;
  }

  const evidenceUsed: string[] = [];
  if (daysUntilRace != null) evidenceUsed.push(`Race in ${daysUntilRace} days`);
  if (context.currentState.freshness != null) {
    evidenceUsed.push(`Freshness ${context.currentState.freshness}`);
  }
  if (context.currentState.fatigueState !== "unknown") {
    evidenceUsed.push(`Fatigue state: ${context.currentState.fatigueState}`);
  }
  if (context.recentTraining.keyChanges.length) {
    evidenceUsed.push(...context.recentTraining.keyChanges.slice(0, 2));
  }
  if (context.forecast?.confidence) {
    evidenceUsed.push(`Forecast confidence: ${context.forecast.confidence}`);
  }

  const constraintNotes = [
    ...context.constraints.notes,
    `Max ${maxHardSessions} hard run session(s)`,
    `Run volume target ${minWeeklyRunKm}–${maxWeeklyRunKm} km`,
    `Long run cap ~${longRunMaxKm} km`,
  ];
  if (context.modalityContext.interferenceRisks.length) {
    constraintNotes.push("Avoid hard non-run work near key runs");
  }
  if (raceWeek) {
    constraintNotes.push("No hard strength within 48h of race");
    constraintNotes.push("Race replaces weekend long run");
  }

  return {
    weekStart,
    planTypeHint,
    maxHardSessions,
    maxWeeklyRunKm,
    minWeeklyRunKm,
    maxVolumeIncreasePct,
    longRunMaxKm: Math.round(longRunMaxKm * 10) / 10,
    minRestDays: raceWeek ? 2 : 1,
    minEasyDaysBetweenHard: 1,
    noHardStrengthHoursBeforeRace: 48,
    noHardStrengthHoursBeforeKeyRun: 24,
    raceWeek,
    taperPhase,
    daysUntilRace,
    avoidIntensityStacking: Boolean(context.constraints.avoidIntensityStacking),
    constraintNotes,
    evidenceUsed,
  };
}

export { DAY_ORDER };
