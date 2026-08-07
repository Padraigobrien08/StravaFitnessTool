import { weeklyPlanToCalendarWeek } from "@/lib/training-calendar";
import type { TrainingCalendarWeek } from "@/lib/training-calendar";

/**
 * Calendar-week fixtures, built by the production mapper.
 *
 * A hand-written `TrainingCalendarWeek` needs around fifteen fields before every
 * consumer stops throwing, and each one you miss surfaces as an unrelated TypeError
 * deep inside a child component. Running a plan through `weeklyPlanToCalendarWeek` —
 * the same function the app uses — means the fixture cannot drift from the type when
 * a field is added.
 */

export const WEEK_START = "2026-03-09";

export function planFixture(workouts?: Array<Record<string, unknown>>) {
  return {
    plan: {
      weekStart: WEEK_START,
      planType: "build",
      summary: "Steady build week",
      hardSessionCount: 1,
      workouts: workouts ?? [
        {
          day: "Monday",
          modality: "run",
          type: "easy",
          title: "Easy 8k",
          distanceKm: 8,
          intensity: "easy",
          purpose: "Aerobic maintenance",
          constraintsApplied: [],
          reasoning: "Conversational effort",
        },
        {
          day: "Wednesday",
          modality: "run",
          type: "tempo",
          title: "Tempo 6k",
          distanceKm: 10,
          intensity: "hard",
          purpose: "Threshold",
          constraintsApplied: [],
          reasoning: "Raise lactate threshold",
        },
      ],
      rationale: {
        primaryGoal: "Aerobic base",
        evidenceUsed: [],
        tradeoffs: [],
        risksManaged: [],
      },
      confidence: "medium",
      limitations: [],
    },
    source: "llm",
    guardrails: { constraintNotes: [] },
    integrity: { verdict: "pass", checks: [] },
  };
}

/** A full seven-day calendar week, with rest days filled in by the mapper. */
export function calendarWeekFixture(
  workouts?: Array<Record<string, unknown>>,
): TrainingCalendarWeek {
  const p = planFixture(workouts);
  return weeklyPlanToCalendarWeek(p.plan as never, p as never);
}
