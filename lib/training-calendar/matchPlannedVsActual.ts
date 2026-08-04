import { parseISO, isWithinInterval } from "date-fns";
import type { RunActivity } from "@/lib/strava/types";
import type { CalendarWorkout, TrainingCalendarWeek } from "./types";

export type ExecutionMatchStatus =
  | "rest_ok"
  | "rest_unplanned_run"
  | "matched"
  | "partial"
  | "missed"
  | "skipped"
  | "marked_done"
  | "future"
  | "no_data";

export interface DayExecutionRow {
  workout: CalendarWorkout;
  status: ExecutionMatchStatus;
  actualRuns: RunActivity[];
  plannedLabel: string;
  actualLabel: string | null;
  note: string | null;
}

export interface WeekExecutionSummary {
  rows: DayExecutionRow[];
  adherencePct: number | null;
  matchedDays: number;
  missedDays: number;
  partialDays: number;
  hasRunData: boolean;
}

function dayIso(date: string): string {
  return date.slice(0, 10);
}

function runsOnDate(runs: RunActivity[], dateIso: string): RunActivity[] {
  return runs.filter((r) => dayIso(r.date) === dateIso);
}

function formatRunSummary(runs: RunActivity[]): string {
  if (runs.length === 0) return "";
  const km = runs.reduce((s, r) => s + r.distanceM / 1000, 0);
  const names = runs.map((r) => r.name).slice(0, 2);
  const extra = runs.length > 2 ? ` +${runs.length - 2}` : "";
  return `${km.toFixed(1)} km · ${names.join(", ")}${extra}`;
}

function plannedLabel(w: CalendarWorkout): string {
  if (w.modality === "rest") return "Rest";
  const parts = [w.title];
  if (w.distanceKm != null) parts.push(`${w.distanceKm} km`);
  if (w.durationMin != null) parts.push(`${w.durationMin} min`);
  return parts.join(" · ");
}

function distanceMatch(
  plannedKm: number | undefined,
  actualKm: number,
): "matched" | "partial" | "missed" {
  if (plannedKm == null || plannedKm <= 0) {
    return actualKm > 0 ? "matched" : "missed";
  }
  const ratio = actualKm / plannedKm;
  if (ratio >= 0.65 && ratio <= 1.45) return "matched";
  if (actualKm > 0.5) return "partial";
  return "missed";
}

function classifyDay(w: CalendarWorkout, runs: RunActivity[], todayIso: string): DayExecutionRow {
  const dateIso = dayIso(w.date);
  const planned = plannedLabel(w);

  if (dateIso > todayIso) {
    return {
      workout: w,
      status: "future",
      actualRuns: runs,
      plannedLabel: planned,
      actualLabel: null,
      note: null,
    };
  }

  if (w.status === "skipped") {
    return {
      workout: w,
      status: "skipped",
      actualRuns: runs,
      plannedLabel: planned,
      actualLabel: runs.length ? formatRunSummary(runs) : null,
      note: runs.length ? "Skipped in plan but activity logged" : null,
    };
  }

  if (w.status === "completed" || w.status === "modified") {
    if (w.modality === "rest") {
      return {
        workout: w,
        status: runs.length ? "rest_unplanned_run" : "marked_done",
        actualRuns: runs,
        plannedLabel: planned,
        actualLabel: runs.length ? formatRunSummary(runs) : null,
        note: null,
      };
    }
    if (runs.length === 0) {
      return {
        workout: w,
        status: "marked_done",
        actualRuns: [],
        plannedLabel: planned,
        actualLabel: null,
        note: "Marked done: no matching import activity",
      };
    }
    const actualKm = runs.reduce((s, r) => s + r.distanceM / 1000, 0);
    const match = distanceMatch(w.distanceKm, actualKm);
    return {
      workout: w,
      status: match === "matched" ? "marked_done" : "partial",
      actualRuns: runs,
      plannedLabel: planned,
      actualLabel: formatRunSummary(runs),
      note: match === "partial" ? "Logged activity differs from plan" : null,
    };
  }

  if (w.modality === "rest") {
    if (runs.length === 0) {
      return {
        workout: w,
        status: "rest_ok",
        actualRuns: [],
        plannedLabel: planned,
        actualLabel: null,
        note: null,
      };
    }
    return {
      workout: w,
      status: "rest_unplanned_run",
      actualRuns: runs,
      plannedLabel: planned,
      actualLabel: formatRunSummary(runs),
      note: "Rest day: extra activity logged",
    };
  }

  if (runs.length === 0) {
    return {
      workout: w,
      status: "missed",
      actualRuns: [],
      plannedLabel: planned,
      actualLabel: null,
      note: "No matching activity in import",
    };
  }

  const actualKm = runs.reduce((s, r) => s + r.distanceM / 1000, 0);
  const match = distanceMatch(w.distanceKm, actualKm);
  return {
    workout: w,
    status: match,
    actualRuns: runs,
    plannedLabel: planned,
    actualLabel: formatRunSummary(runs),
    note:
      match === "partial"
        ? `Planned ${w.distanceKm ?? "?"} km vs ${actualKm.toFixed(1)} km logged`
        : null,
  };
}

export function matchPlannedVsActual(
  week: TrainingCalendarWeek,
  runs: RunActivity[],
  today: Date = new Date(),
): WeekExecutionSummary {
  const todayIso = today.toISOString().slice(0, 10);
  const weekStart = parseISO(week.weekStart);
  const weekEnd = parseISO(week.weekEnd);

  const weekRuns = runs.filter((r) => {
    const d = parseISO(dayIso(r.date));
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  });

  const rows = week.workouts.map((w) =>
    classifyDay(w, runsOnDate(weekRuns, dayIso(w.date)), todayIso),
  );

  const scorable = rows.filter(
    (r) => r.status !== "future" && r.workout.modality !== "rest" && r.status !== "skipped",
  );
  const matchedDays = scorable.filter(
    (r) => r.status === "matched" || r.status === "marked_done",
  ).length;
  const missedDays = scorable.filter((r) => r.status === "missed").length;
  const partialDays = scorable.filter((r) => r.status === "partial").length;

  const adherencePct =
    scorable.length > 0 ? Math.round((matchedDays / scorable.length) * 100) : null;

  return {
    rows,
    adherencePct,
    matchedDays,
    missedDays,
    partialDays,
    hasRunData: weekRuns.length > 0,
  };
}
