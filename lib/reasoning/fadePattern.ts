import { confidenceFromRuns } from "@/lib/intelligence/envelope";
import { computeLateFadePct } from "./executionScore";
import type { AnalyzeFadePatternArgs, ReasoningContext, ReasoningResult } from "./types";

export function analyzeFadePattern(
  ctx: ReasoningContext,
  args: AnalyzeFadePatternArgs = {},
): ReasoningResult<{
  distanceKmThreshold: number;
  runsAnalyzed: number;
  medianLateFadePct: number | null;
  pctRunsWithSignificantFade: number;
  hrDriftWhenFading: number | null;
  examples: { name: string; date: string; distanceKm: number; lateFadePct: number }[];
  narrative: string;
}> {
  const threshold = args.distanceKm ?? 15;

  const longRuns = ctx.runs.filter((r) => r.distanceM / 1000 >= threshold);
  const withFade: {
    run: (typeof ctx.runs)[0];
    fade: number;
    drift: number | null;
  }[] = [];

  for (const run of longRuns) {
    const fit = ctx.fitByRunId.get(run.id) ?? null;
    const fade = computeLateFadePct(fit);
    if (fade != null) {
      withFade.push({
        run,
        fade,
        drift: fit?.hrDriftPct ?? null,
      });
    }
  }

  const limitations: string[] = [];
  if (longRuns.length === 0) {
    limitations.push(`No runs at or above ${threshold} km in your history.`);
  } else if (withFade.length === 0) {
    limitations.push("Long runs found but no FIT pace streams — sync streams or import FIT files.");
  }

  const fades = withFade.map((w) => w.fade).sort((a, b) => a - b);
  const medianLateFadePct = fades.length > 0 ? fades[Math.floor(fades.length / 2)] : null;
  const significant = withFade.filter((w) => w.fade > 6).length;
  const pctRunsWithSignificantFade =
    withFade.length > 0 ? Math.round((significant / withFade.length) * 100) : 0;

  const fadingRuns = withFade.filter((w) => w.fade > 6 && w.drift != null);
  const hrDriftWhenFading =
    fadingRuns.length > 0
      ? Math.round((fadingRuns.reduce((s, w) => s + (w.drift ?? 0), 0) / fadingRuns.length) * 10) /
        10
      : null;

  const examples = [...withFade]
    .sort((a, b) => b.fade - a.fade)
    .slice(0, 3)
    .map((w) => ({
      name: w.run.name,
      date: w.run.date.slice(0, 10),
      distanceKm: Math.round((w.run.distanceM / 1000) * 10) / 10,
      lateFadePct: Math.round(w.fade * 10) / 10,
    }));

  let narrative = `No pace-stream data for runs ≥ ${threshold} km.`;
  if (medianLateFadePct != null) {
    narrative = `Across ${withFade.length} long runs (≥ ${threshold} km), median late-session fade is ~${medianLateFadePct.toFixed(1)}% (final third vs opening third pace). ${pctRunsWithSignificantFade}% showed fade > 6%.`;
    if (hrDriftWhenFading != null) {
      narrative += ` When fading significantly, average HR drift was +${hrDriftWhenFading}%.`;
    }
  }

  const evidence = examples.map(
    (e) => `${e.name} (${e.date}): ${e.distanceKm} km, fade ${e.lateFadePct}%`,
  );

  return {
    payload: {
      distanceKmThreshold: threshold,
      runsAnalyzed: withFade.length,
      medianLateFadePct: medianLateFadePct != null ? Math.round(medianLateFadePct * 10) / 10 : null,
      pctRunsWithSignificantFade,
      hrDriftWhenFading,
      examples,
      narrative,
    },
    evidence,
    assumptions: ["Fade = pace slowdown comparing first third vs last third of FIT pace stream."],
    limitations,
    confidence: confidenceFromRuns(withFade.length),
  };
}
