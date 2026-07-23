import { addWeeks, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import type { WeeklyVolume } from "./volume";
import type { RunWorkoutLabel, WorkoutType } from "./workoutType";
import type { RaceReadiness } from "./readiness";

/**
 * Training-phase catalog — segment training history into recognizable phases
 * (base, build, sharpening/peak, taper, recovery, off) so the athlete can look
 * back on the shape of their training. Deterministic: classify each week from
 * its volume, intensity, load trend, and race proximity, then merge consecutive
 * same-type weeks into phases.
 *
 * Distinct from `find_best_phase`, which ranks a single strongest 4-week window.
 */

export type TrainingPhaseType = "base" | "build" | "peak" | "taper" | "recovery" | "gap";

export interface TrainingPhase {
  type: TrainingPhaseType;
  label: string;
  startWeek: string;
  endWeek: string;
  weeks: number;
  avgWeeklyKm: number;
  hardSharePct: number;
  characterization: string;
}

/** One dense (gap-filled) week of the training history. */
export interface PhaseWeek {
  weekStart: string;
  distanceKm: number;
  runCount: number;
  hardShare: number;
  ctl: number | null;
}

export interface TrainingPhasesInput {
  weeks: PhaseWeek[];
  raceDate: string | null;
}

const HARD_TYPES: ReadonlySet<WorkoutType> = new Set(["tempo", "interval", "race"]);
const WINDOW_WEEKS = 26;
const MIN_PHASE_WEEKS = 2;
const TAPER_WINDOW_DAYS = 21;

const LABELS: Record<TrainingPhaseType, string> = {
  base: "Base",
  build: "Build",
  peak: "Sharpening",
  taper: "Taper",
  recovery: "Recovery",
  gap: "Off / gap",
};

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function classifyWeek(weeks: PhaseWeek[], i: number, raceDate: string | null): TrainingPhaseType {
  const w = weeks[i];
  if (w.runCount === 0 || w.distanceKm < 3) return "gap";

  const prior = weeks.slice(Math.max(0, i - 3), i);
  const trailing = prior.length ? mean(prior.map((p) => p.distanceKm)) : w.distanceKm;

  if (raceDate) {
    const daysToRace = differenceInCalendarDays(parseISO(raceDate), parseISO(w.weekStart));
    if (daysToRace >= 0 && daysToRace <= TAPER_WINDOW_DAYS && w.distanceKm < trailing * 0.9) {
      return "taper";
    }
  }
  if (trailing > 0 && w.distanceKm < trailing * 0.65 && w.hardShare < 0.3) return "recovery";
  if (w.hardShare >= 0.33 && w.distanceKm >= trailing * 0.85) return "peak";
  if (trailing > 0 && w.distanceKm > trailing * 1.08) return "build";

  const ctlNow = w.ctl;
  const ctlPrev = weeks[Math.max(0, i - 2)].ctl;
  if (ctlNow != null && ctlPrev != null && ctlPrev > 0 && ctlNow > ctlPrev * 1.05) return "build";

  return "base";
}

function characterize(type: TrainingPhaseType, avgKm: number, hardPct: number): string {
  switch (type) {
    case "base":
      return `Steady aerobic base, ~${avgKm} km/wk`;
    case "build":
      return `Volume building to ~${avgKm} km/wk`;
    case "peak":
      return `Sharpening — ${hardPct}% hard work at ~${avgKm} km/wk`;
    case "taper":
      return `Easing volume into race day (~${avgKm} km/wk)`;
    case "recovery":
      return `Recovery — volume down to ~${avgKm} km/wk`;
    case "gap":
      return "Break — little or no running";
  }
}

export function detectTrainingPhases(input: TrainingPhasesInput): TrainingPhase[] {
  const weeks = input.weeks;
  if (weeks.length < 4) return [];

  const types = weeks.map((_, i) => classifyWeek(weeks, i, input.raceDate));

  // Smooth single-week islands into their neighbour so phases aren't fragmented.
  for (let i = 0; i < types.length; i++) {
    const prev = i > 0 ? types[i - 1] : null;
    const next = i < types.length - 1 ? types[i + 1] : null;
    if (types[i] !== prev && types[i] !== next) {
      types[i] = prev ?? next ?? types[i];
    }
  }

  // Merge consecutive same-type weeks into phases.
  const phases: TrainingPhase[] = [];
  let start = 0;
  for (let i = 1; i <= types.length; i++) {
    if (i === types.length || types[i] !== types[start]) {
      const slice = weeks.slice(start, i);
      const type = types[start];
      if (slice.length >= MIN_PHASE_WEEKS || type === "gap" || type === "taper") {
        const avgKm = round1(mean(slice.map((w) => w.distanceKm)));
        const hardPct = Math.round(mean(slice.map((w) => w.hardShare)) * 100);
        phases.push({
          type,
          label: LABELS[type],
          startWeek: slice[0].weekStart,
          endWeek: slice[slice.length - 1].weekStart,
          weeks: slice.length,
          avgWeeklyKm: avgKm,
          hardSharePct: hardPct,
          characterization: characterize(type, avgKm, hardPct),
        });
      }
      start = i;
    }
  }

  return phases;
}

/** Build the dense, gap-filled week grid (last 26 weeks) from the analytics bundle. */
export function buildTrainingPhasesInput(analytics: {
  weeklyVolume: WeeklyVolume[];
  loadHistory: { weekStart: string; ctl: number }[];
  workoutLabels: RunWorkoutLabel[];
  raceReadiness: RaceReadiness | null;
}): TrainingPhasesInput {
  const volByWeek = new Map(analytics.weeklyVolume.map((w) => [w.weekStart, w]));
  const ctlByWeek = new Map(analytics.loadHistory.map((h) => [h.weekStart, h.ctl]));

  // Weekly hard-run counts from labels, bucketed to the Monday-aligned week key.
  const hardByWeek = new Map<string, { hard: number; total: number }>();
  for (const l of analytics.workoutLabels) {
    const key = format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const cur = hardByWeek.get(key) ?? { hard: 0, total: 0 };
    cur.total += 1;
    if (HARD_TYPES.has(l.classification.type)) cur.hard += 1;
    hardByWeek.set(key, cur);
  }

  const volumeWeeks = analytics.weeklyVolume;
  if (volumeWeeks.length === 0) return { weeks: [], raceDate: null };

  const lastKey = volumeWeeks[volumeWeeks.length - 1].weekStart;
  const lastMonday = startOfWeek(parseISO(lastKey), { weekStartsOn: 1 });

  const weeks: PhaseWeek[] = [];
  for (let back = WINDOW_WEEKS - 1; back >= 0; back--) {
    const key = format(addWeeks(lastMonday, -back), "yyyy-MM-dd");
    const vol = volByWeek.get(key);
    const hs = hardByWeek.get(key);
    weeks.push({
      weekStart: key,
      distanceKm: vol ? Math.round(vol.distanceKm * 10) / 10 : 0,
      runCount: vol?.runCount ?? 0,
      hardShare: hs && hs.total > 0 ? hs.hard / hs.total : 0,
      ctl: ctlByWeek.get(key) ?? null,
    });
  }

  return { weeks, raceDate: analytics.raceReadiness?.raceDate ?? null };
}
