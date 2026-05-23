import type { WeeklyPlanGuardrails, WeeklyTrainingPlan } from "@/lib/ai-planning";
import { isHardTrainingRun } from "./hardSessionRules";
import type {
  CalendarValidationIssue,
  CalendarValidationResult,
  TrainingCalendarWeek,
} from "./types";
function maxSeverity(
  issues: CalendarValidationIssue[]
): CalendarValidationIssue["severity"] {
  if (issues.some((i) => i.severity === "high")) return "high";
  if (issues.some((i) => i.severity === "medium")) return "medium";
  if (issues.length > 0) return "low";
  return "none";
}

export function validateCalendarWeek(
  week: TrainingCalendarWeek,
  opts?: {
    guardrails?: WeeklyPlanGuardrails;
    integritySeverity?: TrainingCalendarWeek["integritySeverity"];
  }
): CalendarValidationResult {
  const issues: CalendarValidationIssue[] = [];
  const ids = new Set<string>();

  for (const w of week.workouts) {
    if (ids.has(w.id)) {
      issues.push({
        code: "duplicate_id",
        message: `Duplicate workout id: ${w.id}`,
        severity: "high",
      });
    }
    ids.add(w.id);
    const ws = new Date(`${week.weekStart}T12:00:00`);
    const we = new Date(`${week.weekEnd}T12:00:00`);
    const wd = new Date(`${w.date}T12:00:00`);
    if (wd < ws || wd > we) {
      issues.push({
        code: "date_out_of_range",
        message: `${w.title} (${w.date}) is outside the week window`,
        severity: "medium",
      });
    }
  }

  const hardRuns = week.workouts.filter(isHardTrainingRun);
  const maxHard = opts?.guardrails?.maxHardSessions ?? 2;
  if (hardRuns.length > maxHard) {
    issues.push({
      code: "hard_sessions",
      message: `${hardRuns.length} hard run sessions exceed limit of ${maxHard}`,
      severity: "high",
    });
  }

  const plannedKm =
    week.totalRunDistanceKm ??
    week.workouts
      .filter((w) => w.modality === "run" && w.status !== "skipped")
      .reduce((s, w) => s + (w.distanceKm ?? 0), 0);
  const maxKm = opts?.guardrails?.maxWeeklyRunKm;
  if (maxKm != null && plannedKm > maxKm * 1.08) {
    issues.push({
      code: "volume_high",
      message: `Planned run volume (${plannedKm.toFixed(1)} km) exceeds guardrail max (${maxKm} km)`,
      severity: "medium",
    });
  }

  if (opts?.integritySeverity === "high") {
    issues.push({
      code: "integrity_high",
      message: "Plan failed high-severity integrity checks",
      severity: "high",
    });
  }

  const severity = maxSeverity(issues);
  const canSave = severity !== "high";
  return {
    valid: issues.length === 0,
    canSave,
    issues,
  };
}

export function validateBeforeSave(
  week: TrainingCalendarWeek,
  plan: WeeklyTrainingPlan,
  guardrails: WeeklyPlanGuardrails,
  integritySeverity?: TrainingCalendarWeek["integritySeverity"],
  opts?: { source?: "llm" | "repaired" | "fallback" }
): CalendarValidationResult {
  const blockOnIntegrity =
    opts?.source !== "fallback" && integritySeverity === "high";
  return validateCalendarWeek(week, {
    guardrails,
    integritySeverity: blockOnIntegrity ? "high" : undefined,
  });
}
