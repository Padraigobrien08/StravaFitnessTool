import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { WorkoutClassification } from "@/lib/analytics/workoutType";

export interface ExecutionInsight {
  title: string;
  body: string;
  tone: "positive" | "neutral" | "warning";
}

export interface SessionExecutionScore {
  qualityScore: number;
  pacingStabilityScore: number;
  lateFadePct: number | null;
  hrDriftPct: number | null;
  fatigueInterpretation: string;
  insights: ExecutionInsight[];
}

function paceCv(paces: number[]): number | null {
  if (paces.length < 3) return null;
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  if (mean === 0) return null;
  const variance = paces.reduce((s, p) => s + (p - mean) ** 2, 0) / paces.length;
  return Math.sqrt(variance) / mean;
}

export function thirdAvgPace(stream: { elapsedSec: number; paceSecPerKm: number }[]): {
  first: number | null;
  last: number | null;
} {
  if (stream.length < 9) return { first: null, last: null };
  const sorted = [...stream].sort((a, b) => a.elapsedSec - b.elapsedSec);
  const n = sorted.length;
  const third = Math.floor(n / 3);
  const avg = (slice: typeof sorted) => {
    const p = slice.map((p) => p.paceSecPerKm).filter((v) => v > 0 && v < 900);
    if (p.length === 0) return null;
    return p.reduce((a, b) => a + b, 0) / p.length;
  };
  return { first: avg(sorted.slice(0, third)), last: avg(sorted.slice(-third)) };
}

export function computeLateFadePct(fit: FitRunDetail | null): number | null {
  if (!fit?.paceStream || fit.paceStream.length < 12) return null;
  const { first, last } = thirdAvgPace(fit.paceStream);
  if (first == null || last == null || first <= 0) return null;
  return ((last - first) / first) * 100;
}

export function scoreSessionExecution(
  run: RunActivity,
  fit: FitRunDetail | null,
  workout: WorkoutClassification,
): SessionExecutionScore {
  const insights: ExecutionInsight[] = [];
  let quality = 62;
  let pacingStability = 58;

  const drift = fit?.hrDriftPct ?? null;
  if (drift !== null) {
    if (drift <= 4) {
      insights.push({
        title: "HR drift controlled",
        body: `Cardiac drift was +${drift}%. Fatigue remained manageable through the session.`,
        tone: "positive",
      });
      quality += 12;
    } else if (drift > 8) {
      insights.push({
        title: "Elevated HR drift",
        body: `Drift reached +${drift}%. Heat, duration, or intensity may have accumulated late.`,
        tone: "warning",
      });
      quality -= 10;
    } else {
      insights.push({
        title: "Moderate HR drift",
        body: `Drift +${drift}%: typical for sustained threshold or long aerobic work.`,
        tone: "neutral",
      });
    }
  }

  const lapPaces =
    fit?.laps.map((l) => l.avgPaceSecPerKm).filter((p): p is number => p != null && p > 0) ?? [];
  const cv = paceCv(lapPaces);
  if (cv !== null) {
    pacingStability = Math.round(Math.max(0, Math.min(100, 100 - cv * 400)));
    if (cv < 0.04) {
      insights.push({
        title: "Pacing remained stable",
        body: "Lap-to-lap pace variability was low: strong execution discipline.",
        tone: "positive",
      });
      quality += 10;
    } else if (cv > 0.12) {
      insights.push({
        title: "Pace variability elevated",
        body: "Intervals or terrain may explain spread. Check recovery between reps.",
        tone: "neutral",
      });
    }
  }

  const lateFadePct = computeLateFadePct(fit);
  if (lateFadePct !== null) {
    if (lateFadePct < 2) {
      insights.push({
        title: "Minimal late-session fade",
        body: "Final third pace held close to opening rhythm: good fatigue resistance.",
        tone: "positive",
      });
      quality += 8;
    } else if (lateFadePct > 6) {
      insights.push({
        title: "Late-session pace decay",
        body: `Pace slowed ~${lateFadePct.toFixed(0)}% in the final third. Monitor recovery before next quality day.`,
        tone: "warning",
      });
      quality -= 6;
    }
  }

  if (insights.length === 0) {
    insights.push({
      title: "Limited stream detail",
      body: "Import FIT or sync Strava streams for lap-level execution analysis.",
      tone: "neutral",
    });
  }

  const fatigueInterpretation =
    drift != null && drift > 7
      ? "Fatigue accumulated. Prioritize easy volume before the next hard session."
      : drift != null && drift <= 4
        ? "Fatigue response was controlled: body absorbed workload well."
        : workout.type === "recovery" || workout.type === "easy"
          ? "Low stress session: supports absorption of prior load."
          : "Fatigue impact depends on recent block. Pair with freshness on Home.";

  quality = Math.max(0, Math.min(100, quality));
  pacingStability = Math.max(0, Math.min(100, pacingStability));

  return {
    qualityScore: quality,
    pacingStabilityScore: pacingStability,
    lateFadePct,
    hrDriftPct: drift,
    fatigueInterpretation,
    insights,
  };
}
