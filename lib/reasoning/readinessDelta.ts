import {
  halfMarathonReadiness,
  raceReadiness,
  RACE_READINESS_CONFIG,
} from "@/lib/analytics/readiness";
import { lastNDaysVolume } from "@/lib/analytics/volume";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import { confidenceFromRuns } from "@/lib/intelligence/envelope";
import { subDays, parseISO } from "date-fns";
import type { ExplainReadinessDeltaArgs, ReasoningContext, ReasoningResult } from "./types";

export function explainReadinessDelta(
  ctx: ReasoningContext,
  args: ExplainReadinessDeltaArgs = {},
): ReasoningResult<{
  weeks: number;
  now: { score: number; label: string; longestRunKm: number; fourWeekVolumeKm: number };
  then: { score: number; label: string; longestRunKm: number; fourWeekVolumeKm: number };
  scoreDelta: number;
  drivers: { factor: string; thenValue: string; nowValue: string; impact: string }[];
  sessionsInWindow: { date: string; name: string; type: string; distanceKm: number }[];
  narrative: string;
}> {
  const weeks = Math.min(4, Math.max(1, args.weeks ?? 1));
  const cutoff = subDays(new Date(), weeks * 7);
  const runsThen = ctx.runs.filter((r) => parseISO(r.date) <= cutoff);
  const runsNow = ctx.runs;

  const goal = ctx.raceGoal;
  const useRace = goal != null;

  const nowReadiness = useRace
    ? raceReadiness(
        runsNow,
        goal,
        ctx.analytics.personalRecords,
        ctx.analytics.racePredictionAnalysis,
      )
    : halfMarathonReadiness(runsNow);

  const thenReadiness = useRace
    ? raceReadiness(
        runsThen,
        goal,
        ctx.analytics.personalRecords,
        ctx.analytics.racePredictionAnalysis,
      )
    : halfMarathonReadiness(runsThen);

  const scoreDelta = nowReadiness.score - thenReadiness.score;

  const drivers: {
    factor: string;
    thenValue: string;
    nowValue: string;
    impact: string;
  }[] = [
    {
      factor: "Longest run",
      thenValue: `${thenReadiness.longestRunKm.toFixed(1)} km`,
      nowValue: `${nowReadiness.longestRunKm.toFixed(1)} km`,
      impact:
        nowReadiness.longestRunKm > thenReadiness.longestRunKm
          ? "positive"
          : nowReadiness.longestRunKm < thenReadiness.longestRunKm
            ? "negative"
            : "neutral",
    },
    {
      factor: "4-week volume",
      thenValue: `${thenReadiness.fourWeekVolumeKm.toFixed(1)} km`,
      nowValue: `${nowReadiness.fourWeekVolumeKm.toFixed(1)} km`,
      impact:
        nowReadiness.fourWeekVolumeKm > thenReadiness.fourWeekVolumeKm
          ? "positive"
          : nowReadiness.fourWeekVolumeKm < thenReadiness.fourWeekVolumeKm
            ? "negative"
            : "neutral",
    },
  ];

  const sessionsInWindow = ctx.runs
    .filter((r) => {
      const d = parseISO(r.date);
      return d > cutoff;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
    .map((r) => {
      const type = ctx.labelByRunId.get(r.id)?.type ?? "unknown";
      return {
        date: r.date.slice(0, 10),
        name: r.name,
        type: WORKOUT_TYPE_LABELS[type as keyof typeof WORKOUT_TYPE_LABELS] ?? type,
        distanceKm: Math.round((r.distanceM / 1000) * 10) / 10,
      };
    });

  const recentVol = lastNDaysVolume(runsNow, weeks * 7);
  const distanceLabel = useRace ? RACE_READINESS_CONFIG[goal.distance].label : "Half marathon";

  const narrative =
    scoreDelta === 0
      ? `${distanceLabel} readiness unchanged at ${nowReadiness.score} over the last ${weeks} week(s).`
      : scoreDelta > 0
        ? `${distanceLabel} readiness rose ${scoreDelta} points (${thenReadiness.score} → ${nowReadiness.score}), mainly from ${drivers.find((d) => d.impact === "positive")?.factor?.toLowerCase() ?? "training load"} shifts.`
        : `${distanceLabel} readiness fell ${Math.abs(scoreDelta)} points (${thenReadiness.score} → ${nowReadiness.score}). Check longest run and 4-week volume drivers below.`;

  const evidence = [
    `Now: score ${nowReadiness.score}, 4wk ${nowReadiness.fourWeekVolumeKm.toFixed(1)} km, longest ${nowReadiness.longestRunKm.toFixed(1)} km`,
    `Then (${weeks}w ago snapshot): score ${thenReadiness.score}, 4wk ${thenReadiness.fourWeekVolumeKm.toFixed(1)} km`,
    `Last ${weeks}w: ${recentVol.distanceKm.toFixed(1)} km across ${recentVol.runCount} runs`,
  ];

  const limitations: string[] = [];
  const assumptions: string[] = [
    useRace
      ? "Race readiness uses current prediction anchor for both snapshots (historical pace signal approximate)."
      : "Using half-marathon readiness heuristic (60% long run / 40% volume).",
  ];
  if (!useRace) {
    limitations.push("Set a race goal on Goals for distance-specific readiness deltas.");
  }

  return {
    payload: {
      weeks,
      now: {
        score: nowReadiness.score,
        label: nowReadiness.label,
        longestRunKm: nowReadiness.longestRunKm,
        fourWeekVolumeKm: nowReadiness.fourWeekVolumeKm,
      },
      then: {
        score: thenReadiness.score,
        label: thenReadiness.label,
        longestRunKm: thenReadiness.longestRunKm,
        fourWeekVolumeKm: thenReadiness.fourWeekVolumeKm,
      },
      scoreDelta,
      drivers,
      sessionsInWindow,
      narrative,
    },
    evidence,
    assumptions,
    limitations,
    confidence: confidenceFromRuns(ctx.runs.length),
  };
}
