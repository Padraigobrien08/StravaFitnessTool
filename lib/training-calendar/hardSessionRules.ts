/** Shared rules for counting hard run sessions in plans and calendar weeks. */

type WorkoutLike = {
  modality: string;
  type: string;
  title: string;
  intensity: string;
  status?: string;
};

export function isRaceDayWorkout(w: WorkoutLike): boolean {
  return w.type === "race" || /\b(half marathon|marathon|10k|5k|race day)\b/i.test(w.title);
}

/**
 * Hard *training* sessions (tempo, intervals, etc.) — excludes race execution and
 * easy pre-race shakeouts/strides unless explicitly marked hard.
 */
export function isHardTrainingRun(w: WorkoutLike): boolean {
  if (w.modality !== "run") return false;
  if (w.status === "skipped") return false;

  if (isRaceDayWorkout(w)) return false;

  if (/pre[- ]?race|shakeout/i.test(`${w.type} ${w.title}`) && w.intensity !== "hard") {
    return false;
  }

  if (/stride/i.test(w.title) && w.intensity === "easy") return false;

  if (w.intensity === "hard") return true;
  if (w.intensity === "easy" || w.intensity === "recovery" || w.intensity === "rest") {
    return false;
  }

  return /\b(tempo|interval|threshold|quality)\b/i.test(`${w.type} ${w.title}`);
}

/** Hard sessions including race day (for telemetry / plan.hardSessionCount). */
export function isHardRunIncludingRace(w: WorkoutLike): boolean {
  if (w.modality !== "run" || w.status === "skipped") return false;
  if (isRaceDayWorkout(w)) return true;
  return isHardTrainingRun(w);
}

export function countHardTrainingRuns<T extends WorkoutLike>(workouts: T[]): number {
  return workouts.filter(isHardTrainingRun).length;
}
