export type {
  CalendarModality,
  CalendarIntensity,
  CalendarWorkout,
  CalendarWorkoutStatus,
  TrainingCalendarWeek,
  CalendarValidationResult,
  CalendarValidationIssue,
} from "./types";

export {
  saveCalendarWeek,
  getCalendarWeek,
  mergeServerWeeks,
  listCalendarWeeks,
  updateCalendarWorkout,
  deleteCalendarWorkout,
  deleteCalendarWeek,
  clearCalendar,
  hasSavedWeek,
  swapCalendarWorkouts,
} from "./calendarStorage";

export {
  weeklyPlanToCalendarWeek,
  calendarWeekToWeeklyPlan,
  fillWeekWorkouts,
  dateForWeekDay,
  weekEndFromStart,
  targetPlanWeekStart,
  formatWeekRange,
} from "./planToCalendar";

export { validateCalendarWeek, validateBeforeSave } from "./calendarValidation";

export {
  buildCalendarCoachPayload,
  calendarConstraintsForCoach,
  type CalendarCoachPayload,
} from "./calendarCoachContext";

export {
  pushWeekSnapshot,
  getWeekHistory,
  revertCalendarWeek,
  historyCount,
} from "./calendarHistory";

export { swapWorkoutSlots } from "./swapWorkoutDays";

export {
  matchPlannedVsActual,
  type WeekExecutionSummary,
  type DayExecutionRow,
  type ExecutionMatchStatus,
} from "./matchPlannedVsActual";
