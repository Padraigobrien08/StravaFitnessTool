import type { RunActivity } from "@/lib/strava/types";
import type { GoalProgress } from "./goals";
import type { efficiencySummary } from "./efficiency";
import {
  buildCurrentAndPreviousWeek,
  compareWeeks,
  maxLongestRunPriorWeeks,
  getWeekStart,
} from "./week";
import { parseISO } from "date-fns";

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
