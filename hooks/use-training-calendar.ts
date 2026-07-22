"use client";

import { useCallback, useEffect, useState } from "react";
import type { GenerateWeeklyPlanResult } from "@/lib/ai-planning";
import {
  deleteCalendarWeek,
  getCalendarWeek,
  hasSavedWeek,
  saveCalendarWeek,
  targetPlanWeekStart,
  updateCalendarWorkout,
  deleteCalendarWorkout,
  swapCalendarWorkouts,
  weeklyPlanToCalendarWeek,
  validateBeforeSave,
  type CalendarWorkout,
  type TrainingCalendarWeek,
} from "@/lib/training-calendar";

export function useTrainingCalendar(weekStart?: string) {
  const targetWeek = weekStart ?? targetPlanWeekStart();
  const [savedWeek, setSavedWeek] = useState<TrainingCalendarWeek | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setSavedWeek(getCalendarWeek(targetWeek));
    setHydrated(true);
  }, [targetWeek]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveFromGenerated = useCallback(
    (result: GenerateWeeklyPlanResult, opts?: { planningContext?: string }) => {
      const week = weeklyPlanToCalendarWeek(result.plan, result, {
        generatedAt: new Date().toISOString(),
        planningContext: opts?.planningContext,
      });
      const validation = validateBeforeSave(
        week,
        result.plan,
        result.guardrails,
        result.integrity?.severity,
        { source: result.source },
      );
      if (!validation.canSave) {
        return { ok: false as const, validation, week };
      }
      saveCalendarWeek(week);
      setSavedWeek(week);
      return { ok: true as const, validation, week };
    },
    [],
  );

  const clearWeek = useCallback(() => {
    deleteCalendarWeek(targetWeek);
    setSavedWeek(null);
  }, [targetWeek]);

  const patchWorkout = useCallback(
    (
      workoutId: string,
      patch: Partial<
        Pick<
          CalendarWorkout,
          "title" | "durationMin" | "distanceKm" | "status" | "intensity" | "purpose"
        >
      >,
    ) => {
      const updated = updateCalendarWorkout(targetWeek, workoutId, patch);
      if (updated) setSavedWeek(updated);
      return updated;
    },
    [targetWeek],
  );

  const removeWorkout = useCallback(
    (workoutId: string) => {
      const updated = deleteCalendarWorkout(targetWeek, workoutId);
      if (updated) setSavedWeek(updated);
      return updated;
    },
    [targetWeek],
  );

  const swapWorkouts = useCallback(
    (fromWorkoutId: string, toWorkoutId: string) => {
      const updated = swapCalendarWorkouts(targetWeek, fromWorkoutId, toWorkoutId);
      if (updated) setSavedWeek(updated);
      return updated;
    },
    [targetWeek],
  );

  return {
    targetWeek,
    savedWeek,
    hydrated,
    hasSaved: hasSavedWeek(targetWeek),
    refresh,
    saveFromGenerated,
    clearWeek,
    patchWorkout,
    removeWorkout,
    swapWorkouts,
  };
}
