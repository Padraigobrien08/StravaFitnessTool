import { describe, expect, it } from "vitest";
import { swapWorkoutSlots } from "../swapWorkoutDays";
import type { CalendarWorkout } from "../types";

function workout(id: string, day: string, date: string, title: string): CalendarWorkout {
  return {
    id,
    day,
    date,
    modality: "run",
    type: "easy",
    title,
    intensity: "easy",
    purpose: "test",
    status: "planned",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("swapWorkoutSlots", () => {
  it("swaps content while preserving slot day and date", () => {
    const workouts = [
      workout("w-mon", "Mon", "2026-05-25", "Easy run"),
      workout("w-wed", "Wed", "2026-05-27", "Tempo"),
    ];
    const next = swapWorkoutSlots(workouts, "w-mon", "w-wed");
    expect(next).not.toBeNull();
    expect(next![0]).toMatchObject({
      id: "w-mon",
      day: "Mon",
      date: "2026-05-25",
      title: "Tempo",
    });
    expect(next![1]).toMatchObject({
      id: "w-wed",
      day: "Wed",
      date: "2026-05-27",
      title: "Easy run",
    });
  });

  it("returns null for unknown ids", () => {
    const workouts = [workout("w-mon", "Mon", "2026-05-25", "Easy")];
    expect(swapWorkoutSlots(workouts, "w-mon", "missing")).toBeNull();
  });
});
