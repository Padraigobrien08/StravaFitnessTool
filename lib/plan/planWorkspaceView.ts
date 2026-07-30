import { format, parseISO } from "date-fns";
import type { GenerateWeeklyPlanResult } from "@/lib/ai-planning";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { DashboardInsights } from "@/lib/analytics";
import type {
  CalendarValidationIssue,
  CalendarWorkout,
  TrainingCalendarWeek,
} from "@/lib/training-calendar";
import { formatKm } from "@/lib/utils";
import { validateCalendarWeek } from "@/lib/training-calendar/calendarValidation";
import { isHardTrainingRun } from "@/lib/training-calendar/hardSessionRules";

export type IntegrityLevel = "info" | "warning" | "critical";

export interface PlanIntegrityItem {
  id: string;
  level: IntegrityLevel;
  message: string;
  workoutIds: string[];
}

export interface PlanWeekTelemetry {
  volumeKm: number | null;
  hardSessions: number;
  freshness: number;
  freshnessLabel: string;
  goalAlignment: string;
  riskSummary: string | null;
  confidence: string;
}

export interface PlanTodayFocus {
  title: string;
  focus: string;
  avoid: string | null;
  workout: CalendarWorkout | null;
}

const PLAN_TYPE_LABEL: Record<string, string> = {
  build: "Build phase",
  maintain: "Maintenance",
  taper: "Taper",
  recovery: "Recovery",
  race_week: "Race week",
};

export function planPhaseLabel(planType?: string): string {
  if (!planType) return "Adaptive week";
  return PLAN_TYPE_LABEL[planType] ?? planType.replace("_", " ");
}

export function goalContextLabel(
  raceGoal: RaceGoal | null,
  analytics: DashboardInsights | null,
): string | null {
  if (!raceGoal && !analytics?.raceReadiness) return null;
  const r = analytics?.raceReadiness;
  if (r) {
    return `${r.distanceLabel} · ${r.daysUntilRace} days out`;
  }
  if (raceGoal?.distance === "hm") return "Half marathon goal";
  if (raceGoal?.distance === "marathon") return "Marathon goal";
  return "Race goal set";
}

export function buildWeekTelemetry(
  week: TrainingCalendarWeek,
  analytics: DashboardInsights | null,
): PlanWeekTelemetry {
  const volumeKm =
    week.totalRunDistanceKm ??
    week.workouts
      .filter((w) => w.modality === "run" && w.status !== "skipped")
      .reduce((s, w) => s + (w.distanceKm ?? 0), 0);

  const hardSessions =
    week.hardSessionCount ??
    week.workouts.filter(
      (w) =>
        w.modality === "run" &&
        w.status !== "skipped" &&
        (w.intensity === "hard" ||
          /\btempo|interval|threshold|race|quality\b/i.test(`${w.type} ${w.title}`)),
    ).length;

  const freshness = analytics?.fatigue.freshness ?? 0;
  const readiness = analytics?.raceReadiness?.score ?? analytics?.halfMarathonReadiness.score ?? 0;

  let goalAlignment = "moderate";
  if (readiness >= 80) goalAlignment = "strong";
  else if (readiness < 55) goalAlignment = "building";

  let riskSummary: string | null = null;
  if (analytics?.intensityAdvice.status === "too_hard") {
    riskSummary = "intensity stacking elevated";
  } else if (hardSessions > 2) {
    riskSummary = "hard session density high";
  }

  return {
    volumeKm: volumeKm > 0 ? Math.round(volumeKm * 10) / 10 : null,
    hardSessions,
    freshness: Math.round(freshness),
    freshnessLabel: analytics?.fatigue.label ?? "—",
    goalAlignment,
    riskSummary,
    confidence: week.confidence.replace("_", " "),
  };
}

/**
 * Today's session, but only when the week being viewed actually contains today.
 *
 * This used to fall back to matching the weekday *name*, so opening next week's
 * plan on a Wednesday matched next Wednesday's session and presented it as
 * "today in this plan". Returns null for any week that does not span today, and
 * the caller shows week-level framing instead.
 */
export function buildTodayInPlan(week: TrainingCalendarWeek): PlanTodayFocus | null {
  const todayIso = format(new Date(), "yyyy-MM-dd");
  if (todayIso < week.weekStart.slice(0, 10) || todayIso > week.weekEnd.slice(0, 10)) {
    return null;
  }

  const workout = week.workouts.find((w) => w.date.slice(0, 10) === todayIso) ?? null;

  if (!workout || workout.modality === "rest") {
    return {
      title: "Rest / recovery",
      focus: "Absorb load and protect freshness for upcoming sessions.",
      avoid: "Adding unplanned intensity or long efforts.",
      workout,
    };
  }

  const metrics = [
    workout.distanceKm != null ? formatKm(workout.distanceKm) : null,
    workout.durationMin != null ? `${workout.durationMin} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `${workout.title}${metrics ? ` · ${metrics}` : ""}`,
    focus:
      workout.reasoning ??
      workout.purpose ??
      "Execute as planned — stay within prescribed intensity.",
    avoid: inferAvoid(workout, week),
    workout,
  };
}

function inferAvoid(workout: CalendarWorkout, week: TrainingCalendarWeek): string | null {
  const isEasy =
    workout.intensity === "easy" ||
    workout.intensity === "recovery" ||
    /easy|recovery|aerobic/i.test(workout.title);
  const hardNearby = week.workouts.some(
    (w) =>
      w.id !== workout.id &&
      w.modality === "run" &&
      w.intensity === "hard" &&
      w.status !== "skipped",
  );
  if (isEasy && hardNearby) {
    return "Additional threshold work or heavy gym sessions.";
  }
  if (/race/i.test(workout.type + workout.title)) {
    return "Pushing early — trust the taper and race-day pacing.";
  }
  if (workout.intensity === "hard") {
    return "Stacking another quality session within 48 hours.";
  }
  return null;
}

export function buildIntegrityItems(
  week: TrainingCalendarWeek,
  preview: GenerateWeeklyPlanResult | null,
): PlanIntegrityItem[] {
  const validation = validateCalendarWeek(week, {
    guardrails: preview?.guardrails,
    integritySeverity:
      preview?.source === "fallback"
        ? undefined
        : (week.integritySeverity ?? preview?.integrity?.severity),
  });

  const hardWorkouts = week.workouts.filter(
    (w) => w.modality === "run" && w.status !== "skipped" && isHardTrainingRun(w),
  );

  return validation.issues.map((issue, i) => ({
    id: `${issue.code}-${i}`,
    level: mapSeverity(issue),
    message: issue.message,
    workoutIds: issue.code === "hard_sessions" ? hardWorkouts.map((w) => w.id) : [],
  }));
}

function mapSeverity(issue: CalendarValidationIssue): IntegrityLevel {
  if (issue.severity === "high") return "critical";
  if (issue.severity === "medium") return "warning";
  return "info";
}

export function sessionExplainability(week: TrainingCalendarWeek): string[] {
  const lines: string[] = [];
  for (const w of week.workouts) {
    if (w.modality === "rest") continue;
    const reason = w.reasoning ?? w.purpose;
    if (reason && reason.length > 12) {
      lines.push(`${w.day}: ${reason}`);
    }
  }
  if (week.summary && !lines.length) {
    lines.push(week.summary);
  }
  return lines.slice(0, 6);
}

export function formatPlanTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d · HH:mm");
  } catch {
    return iso;
  }
}
