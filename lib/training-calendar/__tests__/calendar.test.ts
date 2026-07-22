import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearCalendar,
  getCalendarWeek,
  hasSavedWeek,
  saveCalendarWeek,
  updateCalendarWorkout,
  deleteCalendarWeek,
} from "../calendarStorage";
import { fillWeekWorkouts, weeklyPlanToCalendarWeek, targetPlanWeekStart } from "../planToCalendar";
import { validateCalendarWeek } from "../calendarValidation";
import type { TrainingCalendarWeek } from "../types";

const mockPlan = {
  weekStart: "2026-05-25",
  planType: "build" as const,
  summary: "Build week with one quality session.",
  totalRunDistanceKm: 42,
  hardSessionCount: 1,
  workouts: [
    {
      day: "Mon",
      modality: "run" as const,
      type: "easy",
      title: "Easy aerobic",
      distanceKm: 8,
      intensity: "easy" as const,
      purpose: "Aerobic base",
      constraintsApplied: [],
      reasoning: "Recovery from weekend",
    },
    {
      day: "Wed",
      modality: "run" as const,
      type: "tempo",
      title: "Tempo",
      distanceKm: 10,
      intensity: "hard" as const,
      purpose: "Lactate tolerance",
      constraintsApplied: [],
      reasoning: "Quality window",
    },
  ],
  rationale: {
    primaryGoal: "Build aerobic base",
    evidenceUsed: ["Recent volume stable"],
    tradeoffs: [],
    risksManaged: ["Intensity stacking"],
  },
  confidence: "medium" as const,
  limitations: ["Limited long-run history"],
};

const mockResult = {
  source: "llm" as const,
  guardrails: {
    weekStart: "2026-05-25",
    planTypeHint: "build" as const,
    maxHardSessions: 2,
    maxWeeklyRunKm: 55,
    minWeeklyRunKm: 20,
    maxVolumeIncreasePct: 15,
    longRunMaxKm: 18,
    minRestDays: 1,
    minEasyDaysBetweenHard: 1,
    noHardStrengthHoursBeforeRace: 48,
    noHardStrengthHoursBeforeKeyRun: 24,
    raceWeek: false,
    taperPhase: false,
    avoidIntensityStacking: true,
    constraintNotes: ["Cap hard sessions at 2"],
    evidenceUsed: [],
  },
  validation: { valid: true, issues: [] },
};

function makeWeek(overrides?: Partial<TrainingCalendarWeek>): TrainingCalendarWeek {
  const base = weeklyPlanToCalendarWeek(mockPlan, mockResult);
  return { ...base, ...overrides };
}

describe("training-calendar", () => {
  beforeEach(() => {
    const mockStore: Record<string, string> = {};
    const mockStorage = {
      getItem(key: string) {
        return mockStore[key] ?? null;
      },
      setItem(key: string, value: string) {
        mockStore[key] = value;
      },
      removeItem(key: string) {
        delete mockStore[key];
      },
    };
    vi.stubGlobal("localStorage", mockStorage);
    clearCalendar();
  });

  it("fills explicit rest days for empty weekdays", () => {
    const week = makeWeek();
    expect(week.workouts).toHaveLength(7);
    const restDays = week.workouts.filter((w) => w.modality === "rest");
    expect(restDays.length).toBeGreaterThanOrEqual(4);
  });

  it("persists and reloads a calendar week", () => {
    const week = makeWeek();
    saveCalendarWeek(week);
    expect(hasSavedWeek(week.weekStart)).toBe(true);
    const loaded = getCalendarWeek(week.weekStart);
    expect(loaded?.summary).toBe(week.summary);
    expect(loaded?.workouts.length).toBe(7);
  });

  it("updates workout status", () => {
    const week = makeWeek();
    saveCalendarWeek(week);
    const mon = week.workouts.find((w) => w.day === "Mon")!;
    const updated = updateCalendarWorkout(week.weekStart, mon.id, {
      status: "completed",
    });
    expect(updated?.workouts.find((w) => w.id === mon.id)?.status).toBe("completed");
  });

  it("blocks save validation on duplicate ids", () => {
    const week = makeWeek();
    const dup = { ...week.workouts[0], id: week.workouts[1].id };
    const bad = { ...week, workouts: [dup, ...week.workouts.slice(1)] };
    const result = validateCalendarWeek(bad, { guardrails: mockResult.guardrails });
    expect(result.canSave).toBe(false);
  });

  it("targetPlanWeekStart returns ISO Monday", () => {
    const ws = targetPlanWeekStart();
    expect(ws).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const day = new Date(ws).getUTCDay();
    expect(day).toBe(1);
  });

  it("deleteCalendarWeek removes storage", () => {
    const week = makeWeek();
    saveCalendarWeek(week);
    deleteCalendarWeek(week.weekStart);
    expect(getCalendarWeek(week.weekStart)).toBeNull();
  });

  it("fillWeekWorkouts preserves sessions", () => {
    const week = makeWeek();
    const filled = fillWeekWorkouts(
      week.weekStart,
      week.workouts.filter((w) => w.modality !== "rest"),
    );
    expect(filled.some((w) => w.title === "Tempo")).toBe(true);
    expect(filled).toHaveLength(7);
  });
});
