import { describe, expect, it } from "vitest";
import { matchPlannedVsActual } from "../matchPlannedVsActual";
import type { CalendarWorkout, TrainingCalendarWeek } from "../types";
import type { RunActivity } from "@/lib/strava/types";

function week(workouts: CalendarWorkout[]): TrainingCalendarWeek {
  return {
    id: "week-2026-05-25",
    weekStart: "2026-05-25",
    weekEnd: "2026-05-31",
    source: "ai_generated",
    summary: "test",
    workouts,
    evidenceUsed: [],
    constraintsApplied: [],
    risksManaged: [],
    limitations: [],
    confidence: "medium",
    savedAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
  };
}

function workout(
  id: string,
  day: string,
  date: string,
  partial: Partial<CalendarWorkout> = {}
): CalendarWorkout {
  return {
    id,
    day,
    date,
    modality: "run",
    type: "easy",
    title: "Easy run",
    distanceKm: 8,
    intensity: "easy",
    purpose: "aerobic",
    status: "planned",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function run(id: string, date: string, distanceM: number): RunActivity {
  return {
    id,
    date,
    name: "Morning Run",
    distanceM,
    elapsedSec: 3600,
    movingSec: 3500,
    avgSpeedMps: 3,
    maxSpeedMps: 4,
    avgHr: 140,
    maxHr: 160,
    elevationGainM: 50,
    calories: 500,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  };
}

describe("matchPlannedVsActual", () => {
  it("marks matched run when distance is close", () => {
    const w = week([
      workout("w-mon", "Mon", "2026-05-25"),
      workout("w-tue", "Tue", "2026-05-26", {
        modality: "rest",
        title: "Rest",
        intensity: "rest",
      }),
    ]);
    const summary = matchPlannedVsActual(
      w,
      [run("r1", "2026-05-25", 7800)],
      new Date("2026-05-26T12:00:00.000Z")
    );
    expect(summary.rows[0].status).toBe("matched");
    expect(summary.matchedDays).toBe(1);
  });

  it("marks missed when no activity", () => {
    const w = week([workout("w-mon", "Mon", "2026-05-25")]);
    const summary = matchPlannedVsActual(
      w,
      [],
      new Date("2026-05-26T12:00:00.000Z")
    );
    expect(summary.rows[0].status).toBe("missed");
  });

  it("flags rest day with unexpected run", () => {
    const w = week([
      workout("w-mon", "Mon", "2026-05-25", {
        modality: "rest",
        title: "Rest",
        intensity: "rest",
      }),
    ]);
    const summary = matchPlannedVsActual(
      w,
      [run("r1", "2026-05-25", 5000)],
      new Date("2026-05-26T12:00:00.000Z")
    );
    expect(summary.rows[0].status).toBe("rest_unplanned_run");
  });
});
