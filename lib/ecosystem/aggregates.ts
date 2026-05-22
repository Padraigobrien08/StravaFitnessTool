import { addDays, format, parseISO } from "date-fns";
import { weekStartKey } from "@/lib/analytics/week";
import type {
  ActivityModality,
  InterferenceFlag,
  NormalizedActivity,
  RollingEcosystemSnapshot,
  RollingWindowDays,
  WeeklyTrainingEcosystem,
} from "./types";

const MS_DAY = 86400000;

export function inWindow(
  dateIso: string,
  days: number,
  ref = new Date()
): boolean {
  return parseISO(dateIso).getTime() >= ref.getTime() - days * MS_DAY;
}

function weekLabel(weekStart: string): string {
  return `W/C ${format(parseISO(weekStart), "d MMM")}`;
}

export function isQualityRun(a: NormalizedActivity): boolean {
  return a.modality === "run" && !!a.isHardRun;
}

function minutesFor(
  activities: NormalizedActivity[],
  pred: (a: NormalizedActivity) => boolean
): number {
  return Math.round(
    activities.filter(pred).reduce((s, a) => s + a.movingTimeSec / 60, 0)
  );
}

function buildDistribution(
  activities: NormalizedActivity[]
): Partial<Record<ActivityModality, number>> {
  const dist: Partial<Record<ActivityModality, number>> = {};
  for (const a of activities) {
    dist[a.modality] = (dist[a.modality] ?? 0) + 1;
  }
  return dist;
}

export function aggregateActivities(
  activities: NormalizedActivity[],
  interferenceFlags: InterferenceFlag[] = [],
  opts?: { weekStart?: string; label?: string }
): WeeklyTrainingEcosystem | RollingEcosystemSnapshot {
  const runs = activities.filter((a) => a.modality === "run");
  const runKm =
    Math.round(
      runs.reduce((s, r) => s + (r.distanceMeters ?? 0) / 1000, 0) * 10
    ) / 10;

  const hiit = activities.filter(
    (a) => a.modality === "high_intensity_cross_training"
  );
  const sport = activities.filter((a) => a.modality === "sport");

  const highIntensitySessions = activities.filter(
    (a) =>
      a.perceivedIntensity === "high" ||
      a.modality === "high_intensity_cross_training"
  ).length;
  const lowIntensitySessions = activities.filter(
    (a) => a.perceivedIntensity === "low"
  ).length;

  const base = {
    runDistanceKm: runKm,
    runCount: runs.length,
    runHardCount: runs.filter(isQualityRun).length,
    runMinutes: minutesFor(activities, (a) => a.modality === "run"),
    bikeMinutes: minutesFor(activities, (a) => a.modality === "bike"),
    swimMinutes: minutesFor(activities, (a) => a.modality === "swim"),
    aerobicCrossTrainingMinutes: minutesFor(
      activities,
      (a) =>
        a.modality === "aerobic_cross_training" ||
        a.modality === "outdoor_endurance"
    ),
    strengthSessions: activities.filter((a) => a.modality === "strength").length,
    mobilitySessions: activities.filter((a) => a.modality === "mobility").length,
    recoverySessions: activities.filter(
      (a) => a.modality === "recovery" || a.modality === "mobility"
    ).length,
    hiitSessions: hiit.length,
    sportSessions: sport.length,
    hiitOrSportSessions: hiit.length + sport.length,
    totalNonRunMinutes: minutesFor(activities, (a) => a.modality !== "run"),
    totalTrainingMinutes: minutesFor(activities, () => true),
    highIntensitySessions,
    lowIntensitySessions,
    modalityDistribution: buildDistribution(activities),
    interferenceFlags: [] as InterferenceFlag[],
    supportSignals: [],
  };

  if (opts?.weekStart) {
    const start = parseISO(opts.weekStart);
    const end = addDays(start, 7);
    const weekFlags = interferenceFlags.filter((f) => {
      const d = parseISO(f.nonRunDate);
      return d >= start && d < end;
    });
    return {
      weekStart: opts.weekStart,
      label: opts.label ?? weekLabel(opts.weekStart),
      ...base,
      interferenceFlags: weekFlags,
    };
  }

  return {
    windowDays: 28 as RollingWindowDays,
    ...base,
  };
}

export function aggregateWeek(
  activities: NormalizedActivity[],
  weekStart: string,
  interferenceFlags: InterferenceFlag[]
): WeeklyTrainingEcosystem {
  const start = parseISO(weekStart);
  const end = addDays(start, 7);
  const inWeek = activities.filter((a) => {
    const d = parseISO(a.startDate);
    return d >= start && d < end;
  });
  return aggregateActivities(inWeek, interferenceFlags, {
    weekStart,
    label: weekLabel(weekStart),
  }) as WeeklyTrainingEcosystem;
}

export function buildRollingSnapshots(
  activities: NormalizedActivity[]
): Partial<Record<RollingWindowDays, RollingEcosystemSnapshot>> {
  const windows: RollingWindowDays[] = [7, 14, 28, 56, 84];
  const out: Partial<Record<RollingWindowDays, RollingEcosystemSnapshot>> = {};
  for (const days of windows) {
    const slice = activities.filter((a) => inWindow(a.startDate, days));
    const snap = aggregateActivities(slice) as RollingEcosystemSnapshot;
    snap.windowDays = days;
    out[days] = snap;
  }
  return out;
}

export function buildRecentWeeks(
  activities: NormalizedActivity[],
  interferenceFlags: InterferenceFlag[],
  maxWeeks = 12
): WeeklyTrainingEcosystem[] {
  const weekKeys = new Set<string>();
  for (const a of activities) {
    weekKeys.add(weekStartKey(parseISO(a.startDate)));
  }
  return [...weekKeys]
    .sort()
    .slice(-maxWeeks)
    .map((ws) => aggregateWeek(activities, ws, interferenceFlags));
}
