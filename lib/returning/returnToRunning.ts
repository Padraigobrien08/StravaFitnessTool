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

export type ReturnTargetSource = "pre-gap" | "best-block" | "custom";

export interface ReturnTargetOption {
  source: ReturnTargetSource;
  weeklyKm: number;
  label: string;
  detail: string;
}

export interface ReturnToRunningPlan {
  gapDays: number;
  /**
   * What the athlete was running in the weeks before the gap. A description of
   * the past, not a prediction: measurement over seven real gaps found it wrong
   * by 2× or more in both directions depending on training phase, so it must
   * not be presented as "your usual week". See docs/proposals/return-baseline.md.
   */
  baseline: ReturnBaseline | null;
  retention: RetentionEstimate;
  /** The ramp, first four weeks. */
  weeks: ReturnWeek[];
  /** Weeks of ramping before `target` is reached. */
  weeksToTarget: number;
  /**
   * Where the ramp is heading. Defaults to the pre-gap weeks, but the athlete
   * can choose, because the thing that decides it — rebuilding versus a planned
   * wind-down after a goal race — is knowledge only they have.
   */
  target: ReturnTargetOption | null;
  /** Targets worth offering, deduplicated and ordered by size. */
  targetOptions: ReturnTargetOption[];
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

/**
 * Median weekly volume and longest run from the weeks preceding the gap.
 *
 * Weeks with no running count as zero. Building the histogram only from weeks
 * that contained runs made this "the median of the weeks you ran", which is not
 * the statistic the name claims — the same defect fixed in `weeklyLoadSeries`,
 * where absent gap weeks stopped CTL/ATL decaying.
 *
 * With a four-week window the two only diverge once two or more weeks are
 * empty; below that the median lands on the same value either way. Checked
 * against eleven real gaps, none of which had two empty weeks, so this changes
 * no number in production today. It is a latent fix, and the athletes it will
 * eventually bite are exactly the ones this module serves: people running
 * sparsely in the weeks before they stop altogether.
 */
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

  const byWeek: number[] = new Array(weeksToSample).fill(0);
  let longestRunKm = 0;
  for (const r of inWindow) {
    const km = r.distanceM / 1000;
    longestRunKm = Math.max(longestRunKm, km);
    const weekIndex = Math.min(
      weeksToSample - 1,
      Math.max(
        0,
        Math.floor((parseISO(r.date).getTime() - windowStart.getTime()) / (7 * 86400000)),
      ),
    );
    byWeek[weekIndex] += km;
  }
  const weekly = [...byWeek].sort((a, b) => a - b);
  const median = weekly[Math.floor(weekly.length / 2)];
  if (median <= 0) return null;

  return {
    weeklyKm: Math.round(median * 10) / 10,
    longestRunKm: Math.round(longestRunKm * 10) / 10,
    weeksSampled: weeksToSample,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Build the ramp. Volume grows about 10% a week, the long-standing conservative
 * rule, and the long run grows with it while staying a fraction of the week.
 */
function buildWeeks(
  startKm: number,
  targetKm: number,
  maxLongRunKm: number,
  gapDays: number,
): ReturnWeek[] {
  const qualityAfter = weeksBeforeQuality(gapDays);
  const weeks: ReturnWeek[] = [];
  for (let i = 0; i < 4; i++) {
    const weekKm = Math.min(targetKm, startKm * Math.pow(1.1, i));
    const quality = i + 1 > qualityAfter;
    weeks.push({
      week: i + 1,
      targetKm: round1(weekKm),
      // Cap the long run at 40% of the week early on: the week should be built
      // from several easy runs, not one long one.
      longestRunKm: round1(Math.min(maxLongRunKm, weekKm * 0.4)),
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

/** Where the ramp starts: a fraction of the pre-gap week, by time away. */
export function restartWeeklyKm(preGapWeeklyKm: number, gapDays: number): number {
  return preGapWeeklyKm * restartFraction(gapDays);
}

/**
 * Which week of the ramp first reaches `targetKm`, growing 10% a week.
 *
 * Week 1 is the restart itself, so week N carries 1.1^(N-1), not 1.1^N. Missing
 * that produced "back to usual in ~4 weeks" while week 4 still targeted 10.3 km
 * against an 11.1 km baseline.
 */
export function weeksToReach(startKm: number, targetKm: number): number {
  if (!(startKm > 0) || !(targetKm > 0) || targetKm <= startKm) return 1;
  return Math.max(1, Math.ceil(Math.log(targetKm / startKm) / Math.log(1.1)) + 1);
}

/**
 * The targets worth offering, largest last.
 *
 * Pre-gap volume is the default because it is the only one always available,
 * but it is a description of the weeks before the gap, and those weeks can be a
 * wind-down after a goal race just as easily as normal training. Where a past
 * block was materially bigger, that is precisely the case no backward-looking
 * statistic can resolve, so both are offered rather than one being guessed at.
 */
export function buildTargetOptions(
  baseline: ReturnBaseline | null,
  bestBlock: { label: string; distanceKm: number } | null,
): ReturnTargetOption[] {
  const options: ReturnTargetOption[] = [];
  if (baseline) {
    options.push({
      source: "pre-gap",
      weeklyKm: baseline.weeklyKm,
      label: "Back to before the gap",
      detail: `What you were averaging over the ${baseline.weeksSampled} weeks before you stopped.`,
    });
  }
  if (bestBlock) {
    // TrainingBlock totals cover four weeks.
    const weeklyKm = round1(bestBlock.distanceKm / 4);
    // Only worth offering when it is a genuinely different answer.
    const materiallyBigger = !baseline || weeklyKm >= baseline.weeklyKm * 1.25;
    if (weeklyKm > 0 && materiallyBigger) {
      options.push({
        source: "best-block",
        weeklyKm,
        label: "Back to my best block",
        detail: `Your strongest four weeks: ${bestBlock.distanceKm} km across ${bestBlock.label}.`,
      });
    }
  }
  return options.sort((a, b) => a.weeklyKm - b.weeklyKm);
}

/**
 * Returns null when the athlete is training currently, so callers can treat a
 * present plan as "this athlete is coming back".
 */
export function buildReturnToRunning(
  runs: RunActivity[],
  fatigue: Pick<FatigueSnapshot, "readiness" | "restDaysSinceLastRun">,
  now = new Date(),
  opts: {
    /** The athlete's chosen weekly target, when they have set one. */
    targetKm?: number | null;
    /** Best four-week block on record, offered as an alternative target. */
    bestBlock?: { label: string; distanceKm: number } | null;
  } = {},
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
  const targetOptions = buildTargetOptions(baseline, opts.bestBlock ?? null);

  // A chosen target wins; otherwise the pre-gap weeks, being the only endpoint
  // available without asking.
  const chosen: ReturnTargetOption | null =
    opts.targetKm && opts.targetKm > 0
      ? (targetOptions.find((o) => Math.abs(o.weeklyKm - opts.targetKm!) < 0.05) ?? {
          source: "custom",
          weeklyKm: round1(opts.targetKm),
          label: "Your target",
          detail: "A weekly volume you set yourself.",
        })
      : (targetOptions.find((o) => o.source === "pre-gap") ?? targetOptions[0] ?? null);

  // The ramp always starts from where they actually were, however ambitious the
  // destination: a bigger target lengthens the climb, it does not raise week 1.
  const startKm = baseline ? restartWeeklyKm(baseline.weeklyKm, gapDays) : 0;
  const targetKm = chosen?.weeklyKm ?? baseline?.weeklyKm ?? 0;
  // With no measured long run to cap against, hold to the 40%-of-week rule.
  const maxLongRunKm = baseline?.longestRunKm ?? targetKm;

  const weeks = baseline ? buildWeeks(startKm, targetKm, maxLongRunKm, gapDays) : [];
  const firstStep = baseline
    ? `Start with ${weeks[0].runs} easy runs this week, about ${weeks[0].targetKm} km total and nothing longer than ${weeks[0].longestRunKm} km.`
    : "Start with two or three short easy runs on non-consecutive days, and judge the next week from how they feel.";

  return {
    gapDays: Math.max(gapDays, differenceInCalendarDays(now, gapStart)),
    baseline,
    retention,
    weeks,
    weeksToTarget: weeksToReach(startKm, targetKm),
    target: chosen,
    targetOptions,
    firstStep,
  };
}
