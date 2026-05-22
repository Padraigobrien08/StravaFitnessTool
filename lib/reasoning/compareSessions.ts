import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import { paceSecPerKm } from "@/lib/analytics/pace";
import { formatPace } from "@/lib/utils";
import { confidenceFromRuns } from "@/lib/intelligence/envelope";
import { scoreSessionExecution } from "./executionScore";
import type {
  CompareSessionsArgs,
  CompareSessionType,
  ReasoningContext,
  ReasoningResult,
} from "./types";

export function compareSessions(
  ctx: ReasoningContext,
  args: CompareSessionsArgs = {}
): ReasoningResult<{
  type: CompareSessionType;
  requested: number;
  sessions: {
    runId: string;
    date: string;
    name: string;
    distanceKm: number;
    pace: string | null;
    avgHr: number | null;
    qualityScore: number;
    pacingStabilityScore: number;
    lateFadePct: number | null;
    hrDriftPct: number | null;
    topInsights: string[];
  }[];
  summary: string;
}> {
  const type = args.type ?? "tempo";
  const n = Math.min(10, Math.max(1, args.n ?? 3));

  const matched = ctx.runs
    .filter((r) => ctx.labelByRunId.get(r.id)?.type === type)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);

  const sessions = matched.map((run) => {
    const fit = ctx.fitByRunId.get(run.id) ?? null;
    const workout = ctx.labelByRunId.get(run.id) ?? {
      type: "unknown" as const,
      confidence: "low" as const,
      signals: [],
    };
    const exec = scoreSessionExecution(run, fit, workout);
    const pace = paceSecPerKm(run);
    return {
      runId: run.id,
      date: run.date,
      name: run.name,
      distanceKm: Math.round((run.distanceM / 1000) * 10) / 10,
      pace: pace ? formatPace(pace) : null,
      avgHr: run.avgHr,
      qualityScore: exec.qualityScore,
      pacingStabilityScore: exec.pacingStabilityScore,
      lateFadePct: exec.lateFadePct,
      hrDriftPct: exec.hrDriftPct,
      topInsights: exec.insights.slice(0, 2).map((i) => i.title),
    };
  });

  const evidence: string[] = [];
  const limitations: string[] = [];
  if (matched.length === 0) {
    limitations.push(
      `No ${WORKOUT_TYPE_LABELS[type]} sessions found in your history.`
    );
  } else {
    for (const s of sessions) {
      evidence.push(
        `${s.name} (${s.date.slice(0, 10)}): quality ${s.qualityScore}, pacing stability ${s.pacingStabilityScore}`
      );
    }
    if (sessions.some((s) => s.lateFadePct == null)) {
      limitations.push(
        "Some sessions lack FIT pace streams — fade metrics may be missing."
      );
    }
  }

  let summary = `No ${WORKOUT_TYPE_LABELS[type]} sessions to compare.`;
  if (sessions.length >= 2) {
    const best = [...sessions].sort(
      (a, b) => b.qualityScore - a.qualityScore
    )[0];
    const worst = [...sessions].sort(
      (a, b) => a.qualityScore - b.qualityScore
    )[0];
    const trend =
      sessions[0].qualityScore - sessions[sessions.length - 1].qualityScore;
    summary = `Best execution: ${best.name} (quality ${best.qualityScore}). Weakest: ${worst.name} (quality ${worst.qualityScore}). Recent vs oldest quality delta: ${trend > 0 ? "+" : ""}${trend} points.`;
  } else if (sessions.length === 1) {
    summary = `Single ${WORKOUT_TYPE_LABELS[type]} session — quality ${sessions[0].qualityScore}/100.`;
  }

  return {
    payload: { type, requested: n, sessions, summary },
    evidence,
    assumptions: [
      `Workout type classified as ${WORKOUT_TYPE_LABELS[type]} via pace/HR heuristics.`,
    ],
    limitations,
    confidence: confidenceFromRuns(ctx.runs.length),
  };
}
