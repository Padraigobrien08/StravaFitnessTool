import type { FatigueSnapshot } from "@/lib/analytics/fatigue";
import type { IntensityAdvice } from "@/lib/analytics/intensityAdvisor";
import type { ConsistencyScore } from "@/lib/analytics/consistency";
import type { RaceReadiness } from "@/lib/analytics/readiness";
import { RACE_READINESS_CONFIG } from "@/lib/analytics/readiness";
import type { WeekSnapshot } from "@/lib/analytics/week";
import type { WeeklyVolume } from "@/lib/analytics/volume";
import type { WorkoutType } from "@/lib/analytics/workoutType";
import { validatePlan } from "./safety";
import {
  addWeeks,
  endOfWeek,
  format,
  getDay,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";

export interface PlannedSession {
  day?: string;
  type: WorkoutType;
  distanceKmRange: [number, number];
  description: string;
}

export interface WeekPlan {
  weekStart: string;
  weekLabel: string;
  totalKmRange: [number, number];
  sessions: PlannedSession[];
  warnings: string[];
  rationale: string[];
  template: string;
}

export interface PlanContext {
  fatigue: FatigueSnapshot;
  intensityAdvice: IntensityAdvice;
  consistencyScore: ConsistencyScore;
  raceReadiness: RaceReadiness | null;
  currentWeek: WeekSnapshot;
  previousWeek: WeekSnapshot | null;
  weeklyVolume: WeeklyVolume[];
  easyHardPct: number;
  runsPerWeekTarget: number;
  maxWeeklyKm?: number;
  longestRunKm: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekBoundsFromStart(start: Date): { weekStart: string; weekLabel: string } {
  const end = endOfWeek(start, { weekStartsOn: 1 });
  return {
    weekStart: format(start, "yyyy-MM-dd"),
    weekLabel: `${format(start, "MMM d")} – ${format(end, "MMM d")}`,
  };
}

/** Default: calendar week after the current one. */
function nextWeekBounds(): { weekStart: string; weekLabel: string } {
  const start = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
  return weekBoundsFromStart(start);
}

/** When a race is soon, plan the ISO week that contains race day (not the week after). */
export function planWeekBounds(
  raceDate: string | undefined,
  daysUntilRace: number | null,
): { weekStart: string; weekLabel: string } {
  if (raceDate && daysUntilRace !== null && daysUntilRace >= 0 && daysUntilRace <= 14) {
    const race = parseISO(raceDate);
    return weekBoundsFromStart(startOfWeek(race, { weekStartsOn: 1 }));
  }
  return nextWeekBounds();
}

export function isRaceInPlanWeek(raceDate: string, weekStart: string): boolean {
  const race = parseISO(raceDate);
  const start = parseISO(weekStart);
  const end = endOfWeek(start, { weekStartsOn: 1 });
  return isWithinInterval(race, { start, end });
}

function raceDayLabel(raceDate: string): (typeof DAY_LABELS)[number] {
  return DAY_LABELS[getDay(parseISO(raceDate))];
}

function dayBefore(label: (typeof DAY_LABELS)[number]): (typeof DAY_LABELS)[number] {
  const idx = DAY_LABELS.indexOf(label);
  return DAY_LABELS[(idx + 6) % 7];
}

function twoDaysBefore(label: (typeof DAY_LABELS)[number]): (typeof DAY_LABELS)[number] {
  const idx = DAY_LABELS.indexOf(label);
  return DAY_LABELS[(idx + 5) % 7];
}

function baselineWeeklyKm(ctx: PlanContext): number {
  const recent = ctx.weeklyVolume.slice(-4);
  if (recent.length === 0) return 25;
  const avg = recent.reduce((s, w) => s + w.distanceKm, 0) / recent.length;
  return Math.round(avg * 10) / 10;
}

function lastCompletedWeekKm(ctx: PlanContext): number {
  return ctx.previousWeek?.distanceKm ?? ctx.currentWeek.distanceKm;
}

function longRunTargetKm(ctx: PlanContext): number {
  if (ctx.raceReadiness) {
    const cfg = RACE_READINESS_CONFIG[ctx.raceReadiness.distance];
    return Math.min(cfg.longRunTargetKm, ctx.longestRunKm + 2);
  }
  return Math.min(18, Math.max(12, ctx.longestRunKm + 1));
}

function buildFatiguePlan(
  ctx: PlanContext,
  week: { weekStart: string; weekLabel: string },
): WeekPlan {
  const base = baselineWeeklyKm(ctx);
  const cap = Math.round(base * 0.9 * 10) / 10;
  return {
    ...week,
    template: "recovery",
    totalKmRange: [Math.round(cap * 0.85 * 10) / 10, cap],
    sessions: [
      { day: "Mon", type: "easy", distanceKmRange: [5, 7], description: "Easy aerobic 30–40 min" },
      {
        day: "Wed",
        type: "easy",
        distanceKmRange: [6, 8],
        description: "Easy run, conversational pace",
      },
      {
        day: "Fri",
        type: "recovery",
        distanceKmRange: [4, 6],
        description: "Short recovery jog or rest",
      },
      {
        day: "Sun",
        type: "easy",
        distanceKmRange: [5, 8],
        description: "Optional easy strides: 4–6 × 20 sec",
      },
    ],
    warnings: [],
    rationale: [
      `Freshness is ${ctx.fatigue.freshness}/100 (${ctx.fatigue.label}) — prioritizing recovery.`,
      `TSB ${ctx.fatigue.tsb > 0 ? "+" : ""}${ctx.fatigue.tsb} suggests backing off intensity.`,
    ],
  };
}

/** Taper week when race is 8–14 days out and falls after this plan week. */
function buildTaperPlan(
  ctx: PlanContext,
  week: { weekStart: string; weekLabel: string },
  daysUntilRace: number,
): WeekPlan {
  const base = baselineWeeklyKm(ctx);
  const factor = 0.65;
  const cap = Math.round(base * factor * 10) / 10;
  const longKm = Math.min(ctx.longestRunKm * 0.55, 12);
  return {
    ...week,
    template: "taper",
    totalKmRange: [Math.round(cap * 0.8 * 10) / 10, cap],
    sessions: [
      { day: "Mon", type: "easy", distanceKmRange: [5, 7], description: "Easy aerobic" },
      {
        day: "Wed",
        type: "tempo",
        distanceKmRange: [4, 6],
        description: "Short tempo: 15–20 min steady",
      },
      {
        day: "Sat",
        type: "long",
        distanceKmRange: [longKm - 1, longKm + 1],
        description: "Easy long run — last moderate effort before race week",
      },
      { day: "Sun", type: "recovery", distanceKmRange: [3, 5], description: "Easy recovery" },
    ],
    warnings: [],
    rationale: [
      `Race in ${daysUntilRace} days — pre-race week; volume ~${Math.round((1 - factor) * 100)}% below baseline.`,
      ctx.raceReadiness
        ? `${ctx.raceReadiness.distanceLabel} readiness: ${ctx.raceReadiness.score}/100.`
        : "Race goal set — protect freshness before race day.",
    ],
  };
}

/** Plan week that contains race day — no long run before race; race session on the correct day. */
function buildRaceWeekPlan(
  ctx: PlanContext,
  week: { weekStart: string; weekLabel: string },
  daysUntilRace: number,
  raceDate: string,
): WeekPlan {
  const readiness = ctx.raceReadiness!;
  const cfg = RACE_READINESS_CONFIG[readiness.distance];
  const raceDay = raceDayLabel(raceDate);
  const preRaceShake = dayBefore(raceDay);
  const lastQualityDay = twoDaysBefore(raceDay);

  const base = baselineWeeklyKm(ctx);
  const factor = daysUntilRace <= 3 ? 0.35 : daysUntilRace <= 7 ? 0.45 : 0.55;
  const cap = Math.round(base * factor * 10) / 10;

  const sessions: PlannedSession[] = [];

  if (daysUntilRace > 5) {
    sessions.push({
      day: "Mon",
      type: "easy",
      distanceKmRange: [5, 7],
      description: "Easy aerobic — stay relaxed",
    });
    sessions.push({
      day: lastQualityDay,
      type: "tempo",
      distanceKmRange: [4, 6],
      description: "Short sharpener: 10–15 min @ race effort, full warm-up/cool-down",
    });
  } else if (daysUntilRace > 3) {
    sessions.push({
      day: "Mon",
      type: "easy",
      distanceKmRange: [4, 6],
      description: "Easy aerobic only",
    });
  }

  if (daysUntilRace >= 2) {
    sessions.push({
      day: preRaceShake,
      type: "easy",
      distanceKmRange: [3, 5],
      description: "Pre-race shakeout — easy jog or rest; no fatigue",
    });
  }

  sessions.push({
    day: raceDay,
    type: "race",
    distanceKmRange: [
      Math.round(cfg.raceDistanceKm * 0.98 * 10) / 10,
      Math.round(cfg.raceDistanceKm * 1.02 * 10) / 10,
    ],
    description: readiness.targetTimeSec
      ? `${readiness.distanceLabel} — target ${formatRaceTarget(readiness.targetTimeSec)}; trust the taper`
      : `${readiness.distanceLabel} — race day; even pacing, fuel early`,
  });

  return {
    ...week,
    template: "race_week",
    totalKmRange: [Math.round(cap * 0.75 * 10) / 10, cap],
    sessions,
    warnings: ["No long run this week — race replaces the weekend long effort."],
    rationale: [
      `Race week (${readiness.distanceLabel} on ${raceDay}) — ${daysUntilRace} day(s) out.`,
      `Volume capped ~${Math.round((1 - factor) * 100)}% below baseline; freshness over fitness.`,
      `${readiness.distanceLabel} readiness: ${readiness.score}/100.`,
    ],
  };
}

function formatRaceTarget(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildEasyBalancePlan(
  ctx: PlanContext,
  week: { weekStart: string; weekLabel: string },
): WeekPlan {
  const base = baselineWeeklyKm(ctx);
  const cap = Math.round(base * 10) / 10;
  const per = Math.round((cap / 4) * 10) / 10;
  return {
    ...week,
    template: "easy_reset",
    totalKmRange: [cap - 4, cap],
    sessions: [
      {
        day: "Tue",
        type: "easy",
        distanceKmRange: [per - 1, per + 1],
        description: "Easy aerobic",
      },
      {
        day: "Thu",
        type: "easy",
        distanceKmRange: [per - 1, per + 1],
        description: "Easy run Z1–Z2",
      },
      {
        day: "Sat",
        type: "easy",
        distanceKmRange: [per, per + 2],
        description: "Easy medium-long",
      },
      {
        day: "Sun",
        type: "recovery",
        distanceKmRange: [4, 6],
        description: "Recovery jog or cross-train",
      },
    ],
    warnings: [],
    rationale: [
      `Only ${ctx.easyHardPct.toFixed(0)}% of runs classified easy — resetting intensity balance.`,
      ctx.intensityAdvice.recommendations[0] ?? "Add easy volume before the next hard session.",
    ],
  };
}

function buildBasePlan(ctx: PlanContext, week: { weekStart: string; weekLabel: string }): WeekPlan {
  const base = baselineWeeklyKm(ctx);
  let cap = Math.round(base * 1.05 * 10) / 10;
  if (ctx.maxWeeklyKm && cap > ctx.maxWeeklyKm) {
    cap = ctx.maxWeeklyKm;
  }
  const longKm = longRunTargetKm(ctx);
  const easy1 = Math.round(cap * 0.22 * 10) / 10;
  const easy2 = Math.round(cap * 0.2 * 10) / 10;
  const quality = Math.round(cap * 0.18 * 10) / 10;

  const allowQuality = ctx.fatigue.freshness >= 50 && ctx.intensityAdvice.status !== "too_hard";

  const sessions: PlannedSession[] = [
    {
      day: "Tue",
      type: "easy",
      distanceKmRange: [easy1 - 1, easy1 + 2],
      description: "Easy aerobic run",
    },
    {
      day: "Thu",
      type: "easy",
      distanceKmRange: [easy2 - 1, easy2 + 2],
      description: "Easy run, nose breathing",
    },
    {
      day: "Sat",
      type: "long",
      distanceKmRange: [longKm - 1, longKm + 2],
      description: `Long easy run — build toward ${longKm.toFixed(0)} km`,
    },
  ];

  if (allowQuality) {
    sessions.splice(2, 0, {
      day: "Wed",
      type: ctx.consistencyScore.overall >= 60 ? "interval" : "tempo",
      distanceKmRange: [quality, quality + 3],
      description:
        ctx.consistencyScore.overall >= 60
          ? "Intervals: 4–6 × 3–5 min @ 10K effort, full recovery"
          : "Tempo: 20–25 min @ threshold after warm-up",
    });
  } else {
    sessions.push({
      day: "Sun",
      type: "recovery",
      distanceKmRange: [4, 6],
      description: "Optional short recovery run",
    });
  }

  return {
    ...week,
    template: "base",
    totalKmRange: [Math.round(cap * 0.9 * 10) / 10, cap],
    sessions,
    warnings: [],
    rationale: [
      `Targeting ~${cap} km (${ctx.runsPerWeekTarget} runs/week goal).`,
      `Consistency ${ctx.consistencyScore.overall}/100 · freshness ${ctx.fatigue.freshness}/100.`,
      allowQuality
        ? "One quality session fits current freshness and intensity balance."
        : "Quality session held — freshness or intensity balance suggests more easy work first.",
    ],
  };
}

export function buildNextWeekPlan(ctx: PlanContext): WeekPlan {
  const raceDate = ctx.raceReadiness?.raceDate;
  const daysUntilRace = ctx.raceReadiness?.daysUntilRace ?? null;
  const week = planWeekBounds(raceDate, daysUntilRace);

  let plan: WeekPlan;

  const raceInPlanWeek =
    raceDate && daysUntilRace !== null && isRaceInPlanWeek(raceDate, week.weekStart);

  if (raceDate && daysUntilRace !== null && daysUntilRace <= 14 && raceInPlanWeek) {
    plan = buildRaceWeekPlan(ctx, week, daysUntilRace, raceDate);
  } else if (ctx.fatigue.freshness < 40 && (daysUntilRace === null || daysUntilRace > 3)) {
    plan = buildFatiguePlan(ctx, week);
  } else if (daysUntilRace !== null && daysUntilRace <= 14) {
    plan = buildTaperPlan(ctx, week, daysUntilRace);
  } else if (ctx.intensityAdvice.status === "too_hard") {
    plan = buildEasyBalancePlan(ctx, week);
  } else if (ctx.currentWeek.runCount === 0 && (ctx.previousWeek?.runCount ?? 0) === 0) {
    plan = {
      ...week,
      template: "return",
      totalKmRange: [12, 20],
      sessions: [
        {
          day: "Any",
          type: "easy",
          distanceKmRange: [5, 8],
          description: "Resume with one easy 30–40 min run",
        },
        {
          day: "Any",
          type: "easy",
          distanceKmRange: [5, 7],
          description: "Second easy run later in the week",
        },
      ],
      warnings: [],
      rationale: ["Little recent running — rebuild gradually before adding intensity."],
    };
  } else {
    plan = buildBasePlan(ctx, week);
  }

  const { plan: safePlan } = validatePlan(plan, lastCompletedWeekKm(ctx), ctx.fatigue.tsb);

  return safePlan;
}

export function buildPlanContextFromInsights(
  analytics: {
    fatigue: FatigueSnapshot;
    intensityAdvice: IntensityAdvice;
    consistencyScore: ConsistencyScore;
    raceReadiness: RaceReadiness | null;
    currentWeek: WeekSnapshot;
    previousWeek: WeekSnapshot | null;
    weeklyVolume: WeeklyVolume[];
    easyHard: { easyPct: number };
    goalProgress: { targetPerWeek: number } | null;
    halfMarathonReadiness: { longestRunKm: number };
  },
  options: { runsPerWeekTarget: number; maxWeeklyKm?: number },
): PlanContext {
  return {
    fatigue: analytics.fatigue,
    intensityAdvice: analytics.intensityAdvice,
    consistencyScore: analytics.consistencyScore,
    raceReadiness: analytics.raceReadiness,
    currentWeek: analytics.currentWeek,
    previousWeek: analytics.previousWeek,
    weeklyVolume: analytics.weeklyVolume,
    easyHardPct: analytics.easyHard.easyPct,
    runsPerWeekTarget: options.runsPerWeekTarget,
    maxWeeklyKm: options.maxWeeklyKm,
    longestRunKm:
      analytics.raceReadiness?.longestRunKm ?? analytics.halfMarathonReadiness.longestRunKm,
  };
}
