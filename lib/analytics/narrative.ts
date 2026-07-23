import type { RunActivity } from "@/lib/strava/types";
import type { GoalProgress } from "./goals";
import type { efficiencySummary, EfficiencyMonthOverMonth } from "./efficiency";
import type { MonthlyVolume } from "./volume";
import type { TrainingBlock } from "./block";
import type { PrTimelinePoint } from "./progression";
import type { ConsistencyScore } from "./consistency";
import type { WorkoutTypeBucket } from "./workoutType";
import type { RaceReadiness } from "./readiness";
import type { FatigueSnapshot } from "./fatigue";
import type { RaceStrategy } from "./raceStrategy";
import {
  buildCurrentAndPreviousWeek,
  compareWeeks,
  maxLongestRunPriorWeeks,
  getWeekStart,
} from "./week";
import { parseISO } from "date-fns";

/** Local h:mm:ss / m:ss formatter — keeps this pure analytics module store-free. */
function formatRaceTime(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "—";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface WeeklyNarrativeInput {
  athleteMaxHr: number;
  dataConfidence: "low" | "medium" | "high";
  goalProgress: GoalProgress | null;
  efficiencySummary: ReturnType<typeof efficiencySummary>;
}

export interface WeeklyNarrative {
  weekLabel: string;
  paragraphs: string[];
  bullets: string[];
  severity: "positive" | "neutral" | "warning";
  confidence: "low" | "medium" | "high";
}

const DEFAULT_WEEKLY_RUN_TARGET = 3;

export function buildWeeklyNarrative(
  runs: RunActivity[],
  input: WeeklyNarrativeInput,
  weekOffset = 0,
  defaultWeeklyRuns = DEFAULT_WEEKLY_RUN_TARGET,
): WeeklyNarrative {
  const { current, previous } = buildCurrentAndPreviousWeek(runs, input.athleteMaxHr, weekOffset);
  const comparison = compareWeeks(current, previous);
  const target = input.goalProgress?.targetPerWeek ?? defaultWeeklyRuns;

  const paragraphs: string[] = [];
  const bullets: string[] = [];

  // 1. Frequency
  if (current.runCount === 0) {
    paragraphs.push(`No runs recorded for the week of ${current.weekLabel}.`);
    bullets.push("0 runs this week");
  } else if (current.runCount >= target) {
    const met = current.runCount === target ? "matching" : "exceeding";
    paragraphs.push(
      `You trained ${current.runCount} time${current.runCount === 1 ? "" : "s"} this week, ${met} your target of ${target}.`,
    );
    bullets.push(`${current.runCount} / ${target} runs this week (target met)`);
  } else {
    const short = target - current.runCount;
    paragraphs.push(
      `You trained ${current.runCount} time${current.runCount === 1 ? "" : "s"} this week, ${short} below your target of ${target}.`,
    );
    bullets.push(`${current.runCount} / ${target} runs this week`);
  }

  // 2. Volume vs prior week
  if (previous && previous.runCount > 0) {
    const dir =
      comparison.distanceKmDelta > 0 ? "up" : comparison.distanceKmDelta < 0 ? "down" : "flat";
    const pct =
      comparison.distancePctChange !== null
        ? ` (${comparison.distancePctChange > 0 ? "+" : ""}${comparison.distancePctChange}%)`
        : "";
    paragraphs.push(
      `Volume was ${current.distanceKm} km, ${dir} from ${previous.distanceKm} km last week${pct}.`,
    );
    bullets.push(`Volume: ${current.distanceKm} km vs ${previous.distanceKm} km last week`);
  } else if (current.distanceKm > 0) {
    paragraphs.push(`Volume was ${current.distanceKm} km this week.`);
    bullets.push(`Volume: ${current.distanceKm} km`);
  }

  // 3. Longest run vs prior 4 weeks
  if (current.longestRunKm > 0) {
    const beforeStart = getWeekStart(parseISO(current.weekStart));
    const priorMax = maxLongestRunPriorWeeks(runs, input.athleteMaxHr, beforeStart, 4);
    if (priorMax > 0 && current.longestRunKm >= priorMax) {
      paragraphs.push(
        `Your longest run was ${current.longestRunKm} km — a high point in the last month.`,
      );
    } else if (priorMax > 0) {
      paragraphs.push(
        `Longest run this week: ${current.longestRunKm} km (recent peak: ${priorMax} km).`,
      );
    } else {
      paragraphs.push(`Longest run this week: ${current.longestRunKm} km.`);
    }
    bullets.push(`Longest run: ${current.longestRunKm} km`);
  }

  // 4. Intensity this week
  const weekTotal = current.easyCount + current.hardCount;
  if (weekTotal > 0) {
    const hardPct = Math.round((current.hardCount / weekTotal) * 100);
    if (hardPct >= 50) {
      paragraphs.push(
        `Intensity was high: ${current.hardCount} of ${weekTotal} runs with HR data were hard (≥80% max HR).`,
      );
      bullets.push(`Intensity: ${current.hardCount}/${weekTotal} hard runs`);
    } else if (current.easyCount >= weekTotal * 0.6) {
      paragraphs.push(
        `Intensity balance looks good: ${current.easyCount} of ${weekTotal} runs were easy.`,
      );
      bullets.push(`Intensity: ${current.easyCount}/${weekTotal} easy runs`);
    } else {
      paragraphs.push(
        `Mixed intensity: ${current.easyCount} easy and ${current.hardCount} hard runs this week.`,
      );
    }
  }

  // 5. Efficiency optional
  if (input.efficiencySummary.trend === "improving") {
    paragraphs.push(
      "Aerobic efficiency is trending up — you're running faster at similar heart rates recently.",
    );
    bullets.push("Efficiency trend: improving");
  }

  let severity: WeeklyNarrative["severity"] = "neutral";
  if (current.runCount === 0) severity = "warning";
  else if (current.runCount >= target && input.efficiencySummary.trend === "improving") {
    severity = "positive";
  } else if (weekTotal > 0 && current.hardCount / weekTotal >= 0.5) {
    severity = "warning";
  }

  const confidence: WeeklyNarrative["confidence"] =
    current.runCount < 2 ? "low" : input.dataConfidence;

  return {
    weekLabel: current.weekLabel,
    paragraphs,
    bullets,
    severity,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Monthly narrative — the training month in prose (trajectory, PRs, mix).
// ---------------------------------------------------------------------------

export interface MonthlyNarrative {
  monthLabel: string;
  headline: string;
  paragraphs: string[];
  highlights: string[];
  severity: "positive" | "neutral" | "warning";
  confidence: "low" | "medium" | "high";
}

export interface MonthlyNarrativeInput {
  monthlyVolume: MonthlyVolume[];
  efficiencyMoM: EfficiencyMonthOverMonth;
  trainingBlocks: TrainingBlock[];
  bestBlock: TrainingBlock | null;
  recentPrs: PrTimelinePoint[];
  consistencyScore: ConsistencyScore;
  workoutTypeMix: WorkoutTypeBucket[];
  dataConfidence: "low" | "medium" | "high";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildMonthlyNarrative(input: MonthlyNarrativeInput): MonthlyNarrative {
  const months = input.monthlyVolume;
  const current = months[months.length - 1] ?? null;
  const prior = months.length >= 2 ? months[months.length - 2] : null;
  const monthLabel = current?.label ?? "Recent training";

  const paragraphs: string[] = [];
  const highlights: string[] = [];
  let volumeUp = false;
  let volumeDropSharp = false;

  // 1. Volume month-over-month.
  if (current) {
    if (prior && prior.distanceKm > 0) {
      const pct = Math.round(((current.distanceKm - prior.distanceKm) / prior.distanceKm) * 100);
      volumeUp = pct > 3;
      volumeDropSharp = pct <= -25;
      const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
      paragraphs.push(
        `You covered ${round1(current.distanceKm)} km across ${current.runCount} run${current.runCount === 1 ? "" : "s"} — ${dir} ${Math.abs(pct)}% from ${round1(prior.distanceKm)} km the month before.`,
      );
      highlights.push(`Volume ${round1(current.distanceKm)} km (${pct > 0 ? "+" : ""}${pct}% MoM)`);
    } else {
      paragraphs.push(
        `You covered ${round1(current.distanceKm)} km across ${current.runCount} run${current.runCount === 1 ? "" : "s"} this month.`,
      );
      highlights.push(`Volume ${round1(current.distanceKm)} km`);
    }
  }

  // 2. Rolling-4-week trajectory + best block.
  if (input.bestBlock && input.trainingBlocks.length >= 2) {
    const latest = input.trainingBlocks[input.trainingBlocks.length - 1];
    const isBest = input.bestBlock.weekStart === latest.weekStart;
    if (isBest) {
      paragraphs.push(
        `Your most recent 4-week block (${round1(latest.distanceKm)} km) is your biggest in the tracked window — fitness is building.`,
      );
      highlights.push("Biggest 4-week block to date");
    } else {
      paragraphs.push(
        `Best 4-week block: ${input.bestBlock.label} at ${round1(input.bestBlock.distanceKm)} km; the latest block is ${round1(latest.distanceKm)} km.`,
      );
    }
  }

  // 3. PRs this month.
  if (input.recentPrs.length > 0) {
    const names = input.recentPrs.slice(0, 3).map((p) => p.label);
    paragraphs.push(
      `You set ${input.recentPrs.length} personal record${input.recentPrs.length === 1 ? "" : "s"} (${names.join(", ")}).`,
    );
    highlights.push(`${input.recentPrs.length} new PR${input.recentPrs.length === 1 ? "" : "s"}`);
  }

  // 4. Efficiency (reuse the ready-made MoM narrative).
  if (input.efficiencyMoM.narrative) {
    paragraphs.push(input.efficiencyMoM.narrative);
  }

  // 5. Consistency.
  if (input.consistencyScore.streakWeeks >= 3) {
    paragraphs.push(
      `Consistency is ${input.consistencyScore.label.toLowerCase()} — ${input.consistencyScore.streakWeeks} weeks running without a gap.`,
    );
    highlights.push(`${input.consistencyScore.streakWeeks}-week streak`);
  }

  // 6. Intensity mix.
  const hard = input.workoutTypeMix.find((b) => b.type === "tempo" || b.type === "interval");
  if (hard && hard.pct >= 30) {
    paragraphs.push(
      `Intensity leaned hard — ${hard.pct}% of runs were tempo or interval work this window.`,
    );
  }

  const effImproving = input.efficiencyMoM.pctChange != null && input.efficiencyMoM.pctChange < 0;
  let severity: MonthlyNarrative["severity"] = "neutral";
  if (volumeDropSharp) severity = "warning";
  else if ((volumeUp || input.recentPrs.length > 0) && effImproving) severity = "positive";

  const headline = volumeDropSharp
    ? "A lighter month — volume stepped back"
    : input.recentPrs.length > 0
      ? `A breakthrough month — ${input.recentPrs.length} PR${input.recentPrs.length === 1 ? "" : "s"}`
      : volumeUp
        ? "Building month — volume trending up"
        : "Steady month";

  const confidence: MonthlyNarrative["confidence"] =
    months.length < 2 ? "low" : input.dataConfidence;

  return { monthLabel, headline, paragraphs, highlights, severity, confidence };
}

// ---------------------------------------------------------------------------
// Pre-race narrative — the race lead-in in prose. Gated to a taper window.
// ---------------------------------------------------------------------------

export interface PreRaceNarrative {
  headline: string;
  daysUntilRace: number;
  paragraphs: string[];
  highlights: string[];
  gamePlan: string;
  severity: "positive" | "neutral" | "warning";
  confidence: "low" | "medium" | "high";
}

export interface PreRaceNarrativeInput {
  raceReadiness: RaceReadiness | null;
  fatigue: FatigueSnapshot;
  raceStrategy: RaceStrategy | null;
  dataConfidence: "low" | "medium" | "high";
}

/** Days out at/under which the pre-race narrative activates (taper window). */
export const PRE_RACE_WINDOW_DAYS = 21;

export function buildPreRaceNarrative(input: PreRaceNarrativeInput): PreRaceNarrative | null {
  const r = input.raceReadiness;
  if (
    !r ||
    r.daysUntilRace == null ||
    r.daysUntilRace < 0 ||
    r.daysUntilRace > PRE_RACE_WINDOW_DAYS
  ) {
    return null;
  }

  const days = r.daysUntilRace;
  const paragraphs: string[] = [];
  const highlights: string[] = [];

  // 1. Readiness.
  paragraphs.push(
    `${days} day${days === 1 ? "" : "s"} out from your ${r.distanceLabel}, readiness is ${r.score}/100 (${r.label})${r.probabilityBand ? ` — ${r.probabilityBand}` : ""}.`,
  );
  highlights.push(`Readiness ${r.score}/100`);

  // 2. Taper / freshness.
  const fresh = Math.round(input.fatigue.freshness);
  let freshnessOk = true;
  if (input.fatigue.freshness >= 50) {
    paragraphs.push(`Freshness is ${fresh} — you're carrying little fatigue into race week.`);
  } else if (input.fatigue.freshness < 35) {
    freshnessOk = false;
    paragraphs.push(
      `Freshness is only ${fresh} — you're still carrying fatigue; ease off to arrive rested.`,
    );
  } else {
    paragraphs.push(`Freshness is ${fresh} — trending toward race-ready with a proper taper.`);
  }
  highlights.push(`Freshness ${fresh}`);

  // 3. Projected finish + fade risk.
  if (input.raceStrategy) {
    paragraphs.push(
      `Target ${formatRaceTime(input.raceStrategy.targetTimeSec)} at even effort; fade risk is ${input.raceStrategy.fadeRisk}.`,
    );
    highlights.push(`Target ${formatRaceTime(input.raceStrategy.targetTimeSec)}`);
  }

  // 4. Top limiter.
  const topGap = r.gaps[0];
  if (topGap) {
    paragraphs.push(
      `Biggest limiter: ${topGap.metric} (${topGap.current}; target ${topGap.target}).`,
    );
  } else if (input.raceStrategy?.fadeFactors[0]) {
    paragraphs.push(`Watch: ${input.raceStrategy.fadeFactors[0]}.`);
  }

  const gamePlan =
    input.raceStrategy?.narrative[0] ??
    (freshnessOk
      ? "Hold your goal effort, start conservative, and trust your training."
      : "Prioritize rest this week; a fresh body beats one more hard session.");

  const highFade = input.raceStrategy?.fadeRisk === "high";
  let severity: PreRaceNarrative["severity"] = "neutral";
  if (r.score < 55 || !freshnessOk || highFade) severity = "warning";
  else if (r.score >= 70 && input.fatigue.freshness >= 50) severity = "positive";

  const headline = `${days} day${days === 1 ? "" : "s"} to your ${r.distanceLabel}`;
  const confidence: PreRaceNarrative["confidence"] = input.raceStrategy
    ? input.dataConfidence
    : "low";

  return { headline, daysUntilRace: days, paragraphs, highlights, gamePlan, severity, confidence };
}
