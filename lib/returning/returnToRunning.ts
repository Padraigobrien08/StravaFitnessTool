import type { RunActivity } from "@/lib/strava/types";
import type { FatigueSnapshot } from "@/lib/analytics/fatigue";
import { parseISO, differenceInCalendarDays } from "date-fns";

/**
 * Returning to running after a gap.
 *
 * Every other surface answers "what should I do today" from current load, which
 * is exactly the question that stops making sense after a layoff: the load model
 * has nothing recent to reason about. This answers the questions that do apply.
 * What did I lose, what did I keep, and how do I get back without getting hurt?
 *
 * The readiness model's currency states drive it (see
 * docs/proposals/readiness-model.md); this module adds the baseline the athlete
 * fell from and a conservative ramp back to it.
 *
 * Everything here is training guidance built from the athlete's own history. It
 * is deliberately conservative and it is not medical advice; an athlete coming
 * back from injury or illness should be guided by whoever is treating them.
 */

export interface ReturnBaseline {
  /** Typical weekly volume before the gap, median of the weeks sampled. */
  weeklyKm: number;
  /** Longest single run before the gap. */
  longestRunKm: number;
  /** Weeks of pre-gap running the baseline is drawn from. */
  weeksSampled: number;
}

export interface RetentionEstimate {
  /** Rough share of aerobic base likely retained, 0-100. */
  aerobicPct: number;
  /** Rough share of top-end sharpness likely retained, 0-100. */
  sharpnessPct: number;
  note: string;
}

export interface ReturnWeek {
  week: number;
  targetKm: number;
  longestRunKm: number;
  /** Suggested number of runs, kept low early so days off outnumber days on. */
  runs: number;
  /** Whether any quality work is sanctioned yet. */
  quality: boolean;
  focus: string;
}

export interface ReturnToRunningPlan {
  gapDays: number;
  /** Null when there is no pre-gap history to measure a baseline from. */
  baseline: ReturnBaseline | null;
  retention: RetentionEstimate;
  /** The ramp, first four weeks. */
  weeks: ReturnWeek[];
  /** Weeks of ramping before pre-gap volume is reached again. */
  weeksToBaseline: number;
  /** The single next thing to do. */
  firstStep: string;
}

/**
 * Share of the pre-gap week to restart on. Longer away means starting lower,
 * because both tissue tolerance and aerobic fitness have moved.
 */
function restartFraction(gapDays: number): number {
  if (gapDays <= 14) return 0.7;
  if (gapDays <= 28) return 0.5;
  if (gapDays <= 56) return 0.4;
  return 0.3;
}

/** Weeks of consistent easy running before quality work is sanctioned. */
function weeksBeforeQuality(gapDays: number): number {
  if (gapDays <= 14) return 1;
  if (gapDays <= 28) return 2;
  return 3;
}

/**
 * Aerobic base outlasts sharpness. Endurance adaptations (capillarisation,
 * mitochondrial density, and years of accumulated base) decay slowly, while
 * top-end speed and running economy fall away faster. Both are estimates
 * presented as such, not measurements.
 */
export function estimateRetention(gapDays: number): RetentionEstimate {
  const weeks = Math.max(0, gapDays - 7) / 7; // the first week costs essentially nothing
  const aerobicPct = Math.max(55, Math.round(100 - weeks * 2.5));
  const sharpnessPct = Math.max(30, Math.round(100 - weeks * 6));
  const note =
    gapDays <= 14
      ? "Short gaps cost sharpness before they cost endurance: the base is intact."
      : gapDays <= 28
        ? "Endurance holds up far better than speed over a few weeks away."
        : "After a month away expect the aerobic base to have softened and speed to have gone first.";
  return { aerobicPct, sharpnessPct, note };
}

/** Median weekly volume and longest run from the weeks preceding the gap. */
export function preGapBaseline(
  runs: RunActivity[],
  gapStart: Date,
  weeksToSample = 4,
): ReturnBaseline | null {
  const windowStart = new Date(gapStart.getTime() - weeksToSample * 7 * 86400000);
  const inWindow = runs.filter((r) => {
    const d = parseISO(r.date);
    return d >= windowStart && d < gapStart;
  });
  if (inWindow.length < 3) return null;

  const byWeek = new Map<number, number>();
  let longestRunKm = 0;
  for (const r of inWindow) {
    const km = r.distanceM / 1000;
    longestRunKm = Math.max(longestRunKm, km);
    const weekIndex = Math.floor(
      (parseISO(r.date).getTime() - windowStart.getTime()) / (7 * 86400000),
    );
    byWeek.set(weekIndex, (byWeek.get(weekIndex) ?? 0) + km);
  }
  const weekly = [...byWeek.values()].sort((a, b) => a - b);
  if (weekly.length === 0) return null;
  const median = weekly[Math.floor(weekly.length / 2)];

  return {
    weeklyKm: Math.round(median * 10) / 10,
    longestRunKm: Math.round(longestRunKm * 10) / 10,
    weeksSampled: weekly.length,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Build the ramp. Volume grows about 10% a week, the long-standing conservative
 * rule, and the long run grows with it while staying a fraction of the week.
 */
function buildWeeks(baseline: ReturnBaseline, gapDays: number): ReturnWeek[] {
  const start = baseline.weeklyKm * restartFraction(gapDays);
  const qualityAfter = weeksBeforeQuality(gapDays);
  const weeks: ReturnWeek[] = [];
  for (let i = 0; i < 4; i++) {
    const targetKm = Math.min(baseline.weeklyKm, start * Math.pow(1.1, i));
    const quality = i + 1 > qualityAfter;
    weeks.push({
      week: i + 1,
      targetKm: round1(targetKm),
      // Cap the long run at 40% of the week early on: the week should be built
      // from several easy runs, not one long one.
      longestRunKm: round1(Math.min(baseline.longestRunKm, targetKm * 0.4)),
      runs: i === 0 ? 3 : 4,
      quality,
      focus: quality
        ? "Easy volume, with one light quality touch if everything feels normal"
        : i === 0
          ? "Easy running only, on non-consecutive days"
          : "Easy running only, adding a day rather than adding pace",
    });
  }
  return weeks;
}

/**
 * Which week of the ramp first reaches the pre-gap volume.
 *
 * Week 1 is the restart itself, so week N carries 1.1^(N-1), not 1.1^N. Missing
 * that produced "back to usual in ~4 weeks" while week 4 still targeted 10.3 km
 * against an 11.1 km baseline.
 */
export function weeksToBaseline(gapDays: number): number {
  const f = restartFraction(gapDays);
  return Math.max(1, Math.ceil(Math.log(1 / f) / Math.log(1.1)) + 1);
}

/**
 * Returns null when the athlete is training currently, so callers can treat a
 * present plan as "this athlete is coming back".
 */
export function buildReturnToRunning(
  runs: RunActivity[],
  fatigue: Pick<FatigueSnapshot, "readiness" | "restDaysSinceLastRun">,
  now = new Date(),
): ReturnToRunningPlan | null {
  const currency = fatigue.readiness?.currency;
  if (currency !== "rusty" && currency !== "detrained" && currency !== "returning") {
    return null;
  }

  const gapDays = fatigue.restDaysSinceLastRun ?? 0;
  const sorted = [...runs].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  const lastRun = sorted[0];
  const gapStart = lastRun ? parseISO(lastRun.date) : now;
  const baseline = preGapBaseline(runs, gapStart);
  const retention = estimateRetention(gapDays);

  const weeks = baseline ? buildWeeks(baseline, gapDays) : [];
  const firstStep = baseline
    ? `Start with ${weeks[0].runs} easy runs this week, about ${weeks[0].targetKm} km total and nothing longer than ${weeks[0].longestRunKm} km.`
    : "Start with two or three short easy runs on non-consecutive days, and judge the next week from how they feel.";

  return {
    gapDays: Math.max(gapDays, differenceInCalendarDays(now, gapStart)),
    baseline,
    retention,
    weeks,
    weeksToBaseline: weeksToBaseline(gapDays),
    firstStep,
  };
}
