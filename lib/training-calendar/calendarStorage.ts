import type { CalendarStorageIndex, CalendarWorkout, TrainingCalendarWeek } from "./types";
import { pushWeekSnapshot } from "./calendarHistory";
import { swapWorkoutSlots } from "./swapWorkoutDays";

const STORAGE_KEY = "strideiq-training-calendar-v1";

function storage(): Storage | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  return globalThis.localStorage;
}

function readIndex(): CalendarStorageIndex {
  const ls = storage();
  if (!ls) {
    return { version: 1, weeks: {} };
  }
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, weeks: {} };
    const parsed = JSON.parse(raw) as CalendarStorageIndex;
    if (parsed.version !== 1 || !parsed.weeks) {
      return { version: 1, weeks: {} };
    }
    return parsed;
  } catch {
    return { version: 1, weeks: {} };
  }
}

/**
 * Persist the calendar index, reporting whether it landed.
 *
 * `readIndex` is wrapped and this was not — the same asymmetry as calendarHistory,
 * and the same consequence: `localStorage.setItem` throws on quota and in Safari
 * private browsing, so saving a week could throw out of a click handler.
 *
 * Unlike the undo history, a failed save here matters to the athlete: their week is
 * not stored and will be gone on reload. So this reports failure rather than
 * swallowing it, and `saveCalendarWeek` passes that up to callers who can say so.
 */
function writeIndex(index: CalendarStorageIndex): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(index));
    return true;
  } catch {
    return false;
  }
}

export function saveCalendarWeek(week: TrainingCalendarWeek): void {
  const index = readIndex();
  const existing = index.weeks[week.weekStart];
  if (existing) {
    pushWeekSnapshot(existing);
  }
  const now = new Date().toISOString();
  const revision = existing ? (existing.revision ?? 1) + 1 : 1;
  index.weeks[week.weekStart] = {
    ...week,
    revision,
    savedAt: week.savedAt || now,
    updatedAt: now,
  };
  // The boolean is deliberately unused here: the callers return void, and the
  // guard exists to stop the throw, not to add a result nobody reads.
  writeIndex(index);
}

export function getCalendarWeek(weekStart: string): TrainingCalendarWeek | null {
  return readIndex().weeks[weekStart] ?? null;
}

/**
 * Merge server-sourced weeks into the local cache (cross-device hydration).
 * Last-write-wins by `updatedAt`; server weeks keep their own revision (no
 * snapshot or bump). Returns true if anything changed locally.
 */
export function mergeServerWeeks(weeks: TrainingCalendarWeek[]): boolean {
  if (weeks.length === 0) return false;
  const index = readIndex();
  let changed = false;
  for (const week of weeks) {
    if (!week?.weekStart) continue;
    const local = index.weeks[week.weekStart];
    if (!local || (week.updatedAt ?? "") > (local.updatedAt ?? "")) {
      index.weeks[week.weekStart] = week;
      changed = true;
    }
  }
  if (changed) writeIndex(index);
  return changed;
}

export function listCalendarWeeks(): TrainingCalendarWeek[] {
  return Object.values(readIndex().weeks).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function updateCalendarWorkout(
  weekStart: string,
  workoutId: string,
  patch: Partial<
    Pick<
      CalendarWorkout,
      "title" | "durationMin" | "distanceKm" | "status" | "intensity" | "purpose" | "type"
    >
  >,
): TrainingCalendarWeek | null {
  const week = getCalendarWeek(weekStart);
  if (!week) return null;
  const idx = week.workouts.findIndex((w) => w.id === workoutId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const nextWorkouts = [...week.workouts];
  nextWorkouts[idx] = {
    ...nextWorkouts[idx],
    ...patch,
    status: patch.status ?? nextWorkouts[idx].status,
    updatedAt: now,
  };
  const updated: TrainingCalendarWeek = {
    ...week,
    workouts: nextWorkouts,
    updatedAt: now,
  };
  saveCalendarWeek(updated);
  return updated;
}

export function deleteCalendarWorkout(
  weekStart: string,
  workoutId: string,
): TrainingCalendarWeek | null {
  const week = getCalendarWeek(weekStart);
  if (!week) return null;
  const updated: TrainingCalendarWeek = {
    ...week,
    workouts: week.workouts.filter((w) => w.id !== workoutId),
    updatedAt: new Date().toISOString(),
  };
  saveCalendarWeek(updated);
  return updated;
}

export function swapCalendarWorkouts(
  weekStart: string,
  fromWorkoutId: string,
  toWorkoutId: string,
): TrainingCalendarWeek | null {
  const week = getCalendarWeek(weekStart);
  if (!week) return null;
  const workouts = swapWorkoutSlots(week.workouts, fromWorkoutId, toWorkoutId);
  if (!workouts) return null;
  const updated: TrainingCalendarWeek = {
    ...week,
    workouts,
    updatedAt: new Date().toISOString(),
  };
  saveCalendarWeek(updated);
  return updated;
}

export function deleteCalendarWeek(weekStart: string): void {
  const index = readIndex();
  delete index.weeks[weekStart];
  writeIndex(index);
}

export function clearCalendar(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* already unreachable */
  }
}

export function hasSavedWeek(weekStart: string): boolean {
  return Boolean(readIndex().weeks[weekStart]);
}
