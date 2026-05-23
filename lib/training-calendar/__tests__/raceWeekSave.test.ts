import { describe, expect, it } from "vitest";
import { validateCalendarWeek } from "../calendarValidation";
import type { CalendarWorkout, TrainingCalendarWeek } from "../types";
import type { WeeklyPlanGuardrails } from "@/lib/ai-planning";

function workout(partial: Partial<CalendarWorkout> & Pick<CalendarWorkout, "id" | "day" | "date">): CalendarWorkout {
  return {
    modality: "run",
    type: "easy",
    title: "Run",
    intensity: "easy",
    purpose: "test",
    status: "planned",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function raceWeekPlan(): TrainingCalendarWeek {
  return {
    id: "week-2026-05-25",
    weekStart: "2026-05-25",
    weekEnd: "2026-05-31",
    source: "fallback",
    summary: "Race week",
    workouts: [
      workout({ id: "w-mon", day: "Mon", date: "2026-05-25", title: "Easy aerobic", distanceKm: 5 }),
      workout({ id: "w-wed", day: "Wed", date: "2026-05-27", title: "Strides", distanceKm: 4, intensity: "easy" }),
      workout({
        id: "w-fri",
        day: "Fri",
        date: "2026-05-29",
        type: "shakeout",
        title: "Pre-race shakeout",
        distanceKm: 3,
        intensity: "easy",
      }),
      workout({
        id: "w-sun",
        day: "Sun",
        date: "2026-05-31",
        type: "race",
        title: "Half marathon",
        distanceKm: 21.1,
        intensity: "hard",
      }),
    ],
    evidenceUsed: [],
    constraintsApplied: [],
    risksManaged: [],
    limitations: [],
    confidence: "medium",
    savedAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
  };
}

const guardrails = {
  maxHardSessions: 1,
  maxWeeklyRunKm: 40,
} as WeeklyPlanGuardrails;

describe("validateCalendarWeek race week", () => {
  it("allows save for standard race-week fallback layout", () => {
    const result = validateCalendarWeek(raceWeekPlan(), { guardrails });
    expect(result.issues.some((i) => i.code === "hard_sessions")).toBe(false);
    expect(result.canSave).toBe(true);
  });
});
