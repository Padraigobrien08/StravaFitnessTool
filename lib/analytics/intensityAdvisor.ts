import type { RunActivity } from "@/lib/strava/types";
import { easyHardSplit } from "./hrZones";
import { runsInLastNDays } from "./week";
import { parseISO, subDays } from "date-fns";

export interface IntensityAdvice {
  /**
   * `paused` means there is history to read but nothing in the last week, so
   * the easy/hard mix describes a block that has ended. It used to be folded
   * into `insufficient_data`, which is a different claim ("we cannot tell")
   * and led consumers that branch on `too_hard` to render a layoff as balanced.
   */
  status: "balanced" | "too_hard" | "too_easy" | "paused" | "insufficient_data";
  easyTargetPct: number;
  currentEasyPct: number;
  hardRunsLast14d: number;
  recommendations: string[];
  suggestedWeekPlan: { type: string; description: string }[];
}

export function hrCoveragePct(runs: RunActivity[]): number {
  if (runs.length === 0) return 0;
  const withHr = runs.filter((r) => r.avgHr !== null).length;
  return Math.round((withHr / runs.length) * 100);
}

export function easyHardLast14Days(
  runs: RunActivity[],
  athleteMaxHr: number,
): { easy: number; hard: number; easyPct: number } {
  const cutoff = subDays(new Date(), 14);
  const recent = runs.filter((r) => parseISO(r.date) >= cutoff);
  return easyHardSplit(recent, athleteMaxHr);
}

export function buildIntensityAdvice(
  runs: RunActivity[],
  athleteMaxHr: number,
  easyHardLifetime: { easy: number; hard: number; easyPct: number },
): IntensityAdvice {
  const easyTargetPct = 80;
  const easyHard14d = easyHardLast14Days(runs, athleteMaxHr);
  const last7Runs = runsInLastNDays(runs, 7);
  const hrCoverage = hrCoveragePct(runs);
  const currentEasyPct = easyHardLifetime.easyPct;

  const recommendations: string[] = [];
  const suggestedWeekPlan: { type: string; description: string }[] = [];

  if (hrCoverage < 50) {
    recommendations.push(
      "Import activities with heart rate (or FIT files) for more accurate intensity advice.",
    );
  }

  if (last7Runs === 0) {
    const hasHistory = easyHardLifetime.easy + easyHardLifetime.hard > 0;
    return {
      status: hasHistory ? "paused" : "insufficient_data",
      easyTargetPct,
      currentEasyPct,
      hardRunsLast14d: easyHard14d.hard,
      recommendations: [
        ...recommendations,
        hasHistory
          ? "No runs in the last 7 days: the mix below describes your last block, not this week. Resume with one easy 30–40 minute run."
          : "No runs in the last 7 days: resume with one easy 30–40 minute run.",
      ],
      suggestedWeekPlan: [
        { type: "easy", description: "1 easy run: 30–40 min, conversational pace" },
      ],
    };
  }

  if (currentEasyPct < 30 && easyHard14d.hard >= 2) {
    recommendations.push(
      "Next 7 days: cap hard sessions at 1; add 2 easy runs of 30–45 min in Z1–Z2.",
      `${easyHard14d.hard} hard runs in the last 14 days: recovery may be lagging volume.`,
    );
    suggestedWeekPlan.push(
      { type: "easy", description: "2 easy runs: 30–45 min, HR below 80% max" },
      { type: "quality", description: "At most 1 hard session (tempo or intervals)" },
    );
    return {
      status: "too_hard",
      easyTargetPct,
      currentEasyPct,
      hardRunsLast14d: easyHard14d.hard,
      recommendations,
      suggestedWeekPlan,
    };
  }

  if (currentEasyPct >= 60) {
    recommendations.push(
      "Polarized balance looks good: keep most runs easy and limit hard days to 1–2 per week.",
    );
    suggestedWeekPlan.push(
      { type: "easy", description: "3–4 easy aerobic runs" },
      { type: "quality", description: "0–1 tempo or interval session if feeling fresh" },
    );
    return {
      status: "balanced",
      easyTargetPct,
      currentEasyPct,
      hardRunsLast14d: easyHard14d.hard,
      recommendations,
      suggestedWeekPlan,
    };
  }

  if (currentEasyPct < 40) {
    recommendations.push("Add more easy volume: aim for ~80% of runs below 80% max HR.");
    suggestedWeekPlan.push({
      type: "easy",
      description: "2–3 easy runs before the next hard session",
    });
    return {
      status: "too_hard",
      easyTargetPct,
      currentEasyPct,
      hardRunsLast14d: easyHard14d.hard,
      recommendations,
      suggestedWeekPlan,
    };
  }

  recommendations.push("Mixed intensity: track easy days explicitly to avoid creeping fatigue.");
  return {
    status: "balanced",
    easyTargetPct,
    currentEasyPct,
    hardRunsLast14d: easyHard14d.hard,
    recommendations,
    suggestedWeekPlan: [
      { type: "easy", description: "2–3 easy runs" },
      { type: "quality", description: "1 moderate session if recovered" },
    ],
  };
}
