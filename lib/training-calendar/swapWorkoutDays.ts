import type { CalendarWorkout } from "./types";

/** Swap training content between two day slots; day labels and dates stay fixed per slot. */
export function swapWorkoutSlots(
  workouts: CalendarWorkout[],
  fromId: string,
  toId: string
): CalendarWorkout[] | null {
  const fromIdx = workouts.findIndex((w) => w.id === fromId);
  const toIdx = workouts.findIndex((w) => w.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null;

  const next = [...workouts];
  const slotA = next[fromIdx];
  const slotB = next[toIdx];
  const now = new Date().toISOString();

  next[fromIdx] = {
    ...slotB,
    id: slotA.id,
    day: slotA.day,
    date: slotA.date,
    updatedAt: now,
  };
  next[toIdx] = {
    ...slotA,
    id: slotB.id,
    day: slotB.day,
    date: slotB.date,
    updatedAt: now,
  };

  return next;
}
