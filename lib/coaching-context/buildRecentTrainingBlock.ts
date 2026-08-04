import { addDays, format, parseISO } from "date-fns";
import type { RunActivity } from "@/lib/strava/types";
import type { NormalizedActivity } from "@/lib/ecosystem/types";
import { weekStartKey } from "@/lib/analytics/week";
import { buildRecentWeeks } from "@/lib/ecosystem/aggregates";
import { collectInterferenceFlags } from "@/lib/ecosystem/interference";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { NotableSession, RecentTrainingBlock, RecentTrainingWeek } from "./types";

const MAX_NOTABLE = 5;
const MAX_WEEKS = 4;

function longRunKm(runs: RunActivity[]): number {
  if (!runs.length) return 0;
  return Math.round(Math.max(...runs.map((r) => r.distanceM / 1000)) * 10) / 10;
}

function weekChangeNotes(prev: RecentTrainingWeek | undefined, cur: RecentTrainingWeek): string[] {
  if (!prev) return [];
  const notes: string[] = [];
  const dKm = cur.runDistanceKm - prev.runDistanceKm;
  if (Math.abs(dKm) >= 5) {
    notes.push(
      dKm > 0
        ? `Run volume up ~${Math.round(dKm)} km vs prior week`
        : `Run volume down ~${Math.round(Math.abs(dKm))} km vs prior week`,
    );
  }
  if (cur.hardRunCount > prev.hardRunCount + 1) {
    notes.push("More hard runs than prior week");
  }
  if (cur.hardRunCount < prev.hardRunCount - 1 && prev.hardRunCount > 0) {
    notes.push("Fewer hard runs: possible taper or recovery");
  }
  if (cur.longRunDistanceKm > prev.longRunDistanceKm + 3) {
    notes.push("Long run extended");
  }
  return notes;
}

function restDaysEstimate(weekStart: string, activityDates: Set<string>): number {
  const start = parseISO(weekStart);
  let rest = 0;
  for (let i = 0; i < 7; i++) {
    const d = format(addDays(start, i), "yyyy-MM-dd");
    if (!activityDates.has(d)) rest++;
  }
  return rest;
}

export function buildRecentTrainingBlock(params: {
  runs: RunActivity[];
  normalizedActivities?: NormalizedActivity[];
  raceGoal?: RaceGoal | null;
  windowDays?: number;
  referenceDate?: Date;
}): RecentTrainingBlock {
  const ref = params.referenceDate ?? new Date();
  const windowDays = params.windowDays ?? 28;
  const cutoff = ref.getTime() - windowDays * 86400000;

  const runsInWindow = params.runs.filter((r) => parseISO(r.date).getTime() >= cutoff);

  const activities = params.normalizedActivities ?? [];
  const flags = collectInterferenceFlags(activities, params.raceGoal ?? null);
  const ecoWeeks = activities.length ? buildRecentWeeks(activities, flags, 12) : [];

  const weekKeys = new Set<string>();
  for (const r of runsInWindow) {
    weekKeys.add(weekStartKey(parseISO(r.date)));
  }
  for (const w of ecoWeeks) {
    weekKeys.add(w.weekStart);
  }

  const sortedKeys = [...weekKeys].sort().slice(-MAX_WEEKS);

  const runsByWeek = new Map<string, RunActivity[]>();
  for (const r of runsInWindow) {
    const k = weekStartKey(parseISO(r.date));
    const list = runsByWeek.get(k) ?? [];
    list.push(r);
    runsByWeek.set(k, list);
  }

  const activityDates = new Set([
    ...runsInWindow.map((r) => r.date.slice(0, 10)),
    ...activities.map((a) => a.startDate.slice(0, 10)),
  ]);

  const weeks: RecentTrainingWeek[] = [];
  let prev: RecentTrainingWeek | undefined;

  for (const weekStart of sortedKeys) {
    const eco = ecoWeeks.find((w) => w.weekStart === weekStart);
    const weekRuns = runsByWeek.get(weekStart) ?? [];
    const hardRuns = weekRuns.filter(
      (r) => (r.avgHr ?? 0) > 0 && (r.maxHr ?? 0) > 0 && r.avgHr! / r.maxHr! >= 0.88,
    );
    const hardCount = eco?.runHardCount ?? hardRuns.length;

    const row: RecentTrainingWeek = {
      weekStart,
      weekLabel: eco?.label ?? `W/C ${format(parseISO(weekStart), "d MMM")}`,
      runDistanceKm:
        eco?.runDistanceKm ??
        Math.round(weekRuns.reduce((s, r) => s + r.distanceM / 1000, 0) * 10) / 10,
      runCount: eco?.runCount ?? weekRuns.length,
      hardRunCount: hardCount,
      longRunDistanceKm: longRunKm(weekRuns),
      totalTrainingMinutes:
        eco?.totalTrainingMinutes ?? Math.round(weekRuns.reduce((s, r) => s + r.movingSec / 60, 0)),
      strengthSessions: eco?.strengthSessions ?? 0,
      mobilitySessions: eco?.mobilitySessions ?? 0,
      crossTrainingMinutes: eco?.totalNonRunMinutes ?? 0,
      highIntensityNonRunSessions: (eco?.hiitSessions ?? 0) + (eco?.sportSessions ?? 0),
      restDaysEstimate: restDaysEstimate(weekStart, activityDates),
      changeNotes: [],
    };
    row.changeNotes = weekChangeNotes(prev, row);
    weeks.push(row);
    prev = row;
  }

  const totalKm = weeks.reduce((s, w) => s + w.runDistanceKm, 0);
  const totalRuns = weeks.reduce((s, w) => s + w.runCount, 0);
  const summary =
    weeks.length === 0
      ? "No run data in the selected window."
      : `${windowDays}d: ${totalRuns} runs, ${Math.round(totalKm)} km across ${weeks.length} week(s).`;

  const keyChanges = weeks.flatMap((w) => w.changeNotes).slice(-6);

  const notableSessions = pickNotableSessions(runsInWindow, activities).slice(0, MAX_NOTABLE);

  return {
    windowDays,
    weeks,
    summary,
    keyChanges,
    notableSessions,
  };
}

function pickNotableSessions(
  runs: RunActivity[],
  activities: NormalizedActivity[],
): NotableSession[] {
  const out: NotableSession[] = [];

  const sortedRuns = [...runs].sort(
    (a, b) => b.distanceM - a.distanceM || b.movingSec - a.movingSec,
  );
  for (const r of sortedRuns.slice(0, 3)) {
    const km = Math.round((r.distanceM / 1000) * 10) / 10;
    out.push({
      date: r.date.slice(0, 10),
      label: r.name || "Run",
      distanceKm: km,
      durationMin: Math.round(r.movingSec / 60),
      type: "run",
      note:
        km >= 16
          ? "Long or race-specific distance"
          : r.avgHr && r.avgHr > 165
            ? "Higher-effort session"
            : "Notable run volume",
    });
  }

  const hardNonRun = activities
    .filter(
      (a) =>
        a.modality !== "run" &&
        (a.perceivedIntensity === "high" || a.modality === "high_intensity_cross_training"),
    )
    .sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());
  for (const a of hardNonRun.slice(0, 2)) {
    out.push({
      date: a.startDate.slice(0, 10),
      label: a.name || a.sportType,
      durationMin: Math.round(a.movingTimeSec / 60),
      type: a.modality,
      note: "High-intensity non-run work",
    });
  }

  return out.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
}

/** Rolling snapshots for 7/14/21/28 day windows (compact summaries). */
export function buildRollingWindowSummaries(
  block: RecentTrainingBlock,
): { days: number; summary: string }[] {
  const windows = [7, 14, 21, 28].filter((d) => d <= block.windowDays);
  const ref = new Date();
  return windows.map((days) => {
    const cutoff = ref.getTime() - days * 86400000;
    const relevant = block.weeks.filter(
      (w) => parseISO(w.weekStart).getTime() + 7 * 86400000 >= cutoff,
    );
    const km = relevant.reduce((s, w) => s + w.runDistanceKm, 0);
    const runs = relevant.reduce((s, w) => s + w.runCount, 0);
    const hard = relevant.reduce((s, w) => s + w.hardRunCount, 0);
    return {
      days,
      summary: `Last ${days}d: ${runs} runs, ${Math.round(km)} km, ${hard} hard run(s).`,
    };
  });
}
