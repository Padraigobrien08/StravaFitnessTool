import { addDays, format, parseISO } from "date-fns";
import type { GenerateWeeklyPlanResult } from "@/lib/ai-planning";
import type { PlannedWorkout, WeeklyTrainingPlan } from "@/lib/ai-planning";
import { nextPlanWeekStart } from "@/lib/ai-planning/weeklyPlanGuardrails";
import type {
  CalendarModality,
  CalendarWeekSource,
  CalendarWorkout,
  TrainingCalendarWeek,
} from "./types";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function dayIndex(day: string): number {
  const d = day.slice(0, 3).toLowerCase();
  const i = DAY_ORDER.findIndex((x) => x.toLowerCase() === d);
  return i >= 0 ? i : 0;
}

export function dateForWeekDay(weekStart: string, day: string): string {
  const base = parseISO(weekStart);
  return format(addDays(base, dayIndex(day)), "yyyy-MM-dd");
}

export function weekEndFromStart(weekStart: string): string {
  return format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
}

function newWorkoutId(weekStart: string, day: string, suffix = ""): string {
  return `w-${weekStart}-${day.slice(0, 3).toLowerCase()}${suffix ? `-${suffix}` : ""}`;
}

function mapSource(source: GenerateWeeklyPlanResult["source"]): CalendarWeekSource {
  if (source === "fallback") return "fallback";
  return "ai_generated";
}

function plannedToCalendarWorkout(
  weekStart: string,
  w: PlannedWorkout,
  planId: string,
  now: string,
): CalendarWorkout {
  return {
    id: newWorkoutId(weekStart, w.day),
    sourcePlanId: planId,
    date: dateForWeekDay(weekStart, w.day),
    day: w.day.slice(0, 3),
    modality: w.modality as CalendarModality,
    type: w.type,
    title: w.title,
    durationMin: w.durationMin,
    distanceKm: w.distanceKm,
    intensity: w.intensity,
    purpose: w.purpose,
    reasoning: w.reasoning,
    constraintsApplied: w.constraintsApplied,
    status: "planned",
    createdAt: now,
    updatedAt: now,
  };
}

function restDayWorkout(weekStart: string, day: string, now: string): CalendarWorkout {
  return {
    id: newWorkoutId(weekStart, day, "rest"),
    date: dateForWeekDay(weekStart, day),
    day,
    modality: "rest",
    type: "rest",
    title: "Rest day",
    intensity: "rest",
    purpose: "Recovery and adaptation",
    status: "planned",
    createdAt: now,
    updatedAt: now,
  };
}

/** Ensure Mon–Sun are represented; explicit rest days where no session exists. */
export function fillWeekWorkouts(
  weekStart: string,
  workouts: CalendarWorkout[],
): CalendarWorkout[] {
  const byDay = new Map<string, CalendarWorkout>();
  for (const w of workouts) {
    const key = w.day.slice(0, 3);
    if (!byDay.has(key) || w.modality !== "rest") {
      byDay.set(key, { ...w, day: key });
    }
  }
  const now = new Date().toISOString();
  return DAY_ORDER.map((day) => {
    const existing = byDay.get(day);
    if (existing) return existing;
    return restDayWorkout(weekStart, day, now);
  });
}

export function weeklyPlanToCalendarWeek(
  plan: WeeklyTrainingPlan,
  result: Pick<GenerateWeeklyPlanResult, "source" | "guardrails" | "integrity">,
  opts?: { planId?: string; generatedAt?: string; planningContext?: string },
): TrainingCalendarWeek {
  const now = new Date().toISOString();
  const weekStart = plan.weekStart;
  const planId = opts?.planId ?? `plan-${weekStart}-${Date.now()}`;
  const mapped = plan.workouts.map((w) => plannedToCalendarWorkout(weekStart, w, planId, now));
  const workouts = fillWeekWorkouts(weekStart, mapped);

  return {
    id: `week-${weekStart}`,
    weekStart,
    weekEnd: weekEndFromStart(weekStart),
    source: mapSource(result.source),
    planId,
    planType: plan.planType,
    summary: plan.summary,
    workouts,
    evidenceUsed: plan.rationale.evidenceUsed,
    constraintsApplied: [
      ...new Set([
        ...result.guardrails.constraintNotes,
        ...plan.workouts.flatMap((w) => w.constraintsApplied),
      ]),
    ],
    risksManaged: plan.rationale.risksManaged,
    limitations: plan.limitations,
    confidence: plan.confidence,
    totalRunDistanceKm: plan.totalRunDistanceKm,
    hardSessionCount: plan.hardSessionCount,
    integrityPassed: result.integrity?.passed,
    integritySeverity: result.integrity?.severity,
    generatedAt: opts?.generatedAt ?? now,
    savedAt: now,
    updatedAt: now,
    planningContext: opts?.planningContext?.trim() || undefined,
  };
}

export function calendarWeekToWeeklyPlan(week: TrainingCalendarWeek): WeeklyTrainingPlan {
  const sessions = week.workouts.filter((w) => w.modality !== "rest");
  return {
    weekStart: week.weekStart,
    planType: (week.planType as WeeklyTrainingPlan["planType"]) ?? "maintain",
    summary: week.summary,
    totalRunDistanceKm: week.totalRunDistanceKm,
    hardSessionCount:
      week.hardSessionCount ??
      sessions.filter(
        (w) =>
          w.modality === "run" &&
          (w.intensity === "hard" || /\btempo|interval|threshold/i.test(w.type)),
      ).length,
    workouts: sessions.map((w) => ({
      day: w.day,
      modality: w.modality as PlannedWorkout["modality"],
      type: w.type,
      title: w.title,
      durationMin: w.durationMin,
      distanceKm: w.distanceKm,
      intensity: w.intensity as PlannedWorkout["intensity"],
      purpose: w.purpose,
      constraintsApplied: w.constraintsApplied ?? [],
      reasoning: w.reasoning ?? w.purpose,
    })),
    rationale: {
      primaryGoal: week.summary,
      evidenceUsed: week.evidenceUsed,
      tradeoffs: [],
      risksManaged: week.risksManaged,
    },
    confidence: week.confidence,
    limitations: week.limitations,
  };
}

export function targetPlanWeekStart(): string {
  return nextPlanWeekStart();
}

export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = parseISO(weekStart);
  const end = parseISO(weekEnd);
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}
