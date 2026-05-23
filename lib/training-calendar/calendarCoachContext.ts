import type { GenerateWeeklyPlanResult } from "@/lib/ai-planning";
import type { TrainingCalendarWeek } from "./types";
import { formatWeekRange } from "./planToCalendar";

export interface CalendarCoachPayload {
  savedCalendarWeek: TrainingCalendarWeek | null;
  unsavedGeneratedPlan: {
    weekStart: string;
    summary: string;
    source: string;
    workoutCount: number;
  } | null;
  summaryText: string;
}

export function buildCalendarCoachPayload(
  saved: TrainingCalendarWeek | null,
  preview: GenerateWeeklyPlanResult | null
): CalendarCoachPayload {
  const unsavedGeneratedPlan = preview
    ? {
        weekStart: preview.plan.weekStart,
        summary: preview.plan.summary,
        source: preview.source,
        workoutCount: preview.plan.workouts.length,
      }
    : null;

  const parts: string[] = [];
  if (saved) {
    parts.push(
      `Saved training calendar for ${formatWeekRange(saved.weekStart, saved.weekEnd)}: ${saved.summary}`
    );
    parts.push(
      `Sessions: ${saved.workouts.filter((w) => w.modality !== "rest").length} planned, ${saved.workouts.filter((w) => w.status === "completed").length} completed.`
    );
  }
  if (unsavedGeneratedPlan) {
    parts.push(
      `Unsaved AI preview for w/c ${unsavedGeneratedPlan.weekStart} (${unsavedGeneratedPlan.source}): ${unsavedGeneratedPlan.summary}`
    );
  }
  if (!saved && !unsavedGeneratedPlan) {
    parts.push("No saved or preview plan for next week.");
  }

  return {
    savedCalendarWeek: saved,
    unsavedGeneratedPlan,
    summaryText: parts.join(" "),
  };
}

export function calendarConstraintsForCoach(
  payload: CalendarCoachPayload
): string[] {
  const notes: string[] = [];
  if (payload.savedCalendarWeek) {
    notes.push(payload.summaryText);
    notes.push(
      "User may ask to modify the saved plan — return changes as an updated weekly plan preview; user must save to calendar."
    );
  }
  if (payload.unsavedGeneratedPlan) {
    notes.push(
      "An unsaved generated preview exists; prefer modifying that plan unless user asks to start fresh."
    );
  }
  return notes;
}
