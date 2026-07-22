import { formatDuration } from "@/lib/utils";
import { buildRaceForecastV2 } from "@/lib/forecasting-v2/forecastEngine";
import { buildRaceForecastInput } from "@/lib/forecasting-v2/buildInput";
import type { RaceForecastInput, RaceForecastV2 } from "@/lib/forecasting-v2/forecastTypes";
import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";

/**
 * Adaptive goal-scenario engine — "what would it take to hit my goal?"
 *
 * Deterministic. The probability is NOT invented: each scenario perturbs the
 * training levers the forecast engine actually reads (recent-block volume,
 * long-run distance, weekly quality sessions), re-runs `buildRaceForecastV2`,
 * and maps the target time onto the resulting prediction interval. Language
 * layers (Coach, Goals panel) surface these numbers; they must not fabricate them.
 */

/** Probability at/above which a target is called "likely". */
const LIKELY_PCT = 70;

export interface GoalLever {
  /** Weekly-volume multiplier vs current (1.0 = no change). */
  volumeMultiplier: number;
  /** Additional quality (tempo/interval) sessions per week vs current. */
  extraQualityPerWeek: number;
  /** Long-run distance to build toward (km); null = keep current. */
  longRunKm: number | null;
}

export interface GoalScenario {
  id: string;
  label: string;
  /** Human-readable lever, e.g. "+12% volume (~48 km/wk) · +1 quality/wk". */
  leverSummary: string;
  projectedTimeSec: number;
  projectedTimeLabel: string;
  /** P(finish ≤ target) from the perturbed prediction interval; null if no target. */
  probabilityPct: number | null;
  meetsTarget: boolean;
  rationale: string[];
}

export interface GoalScenarioResult {
  hasTarget: boolean;
  targetTimeSec: number | null;
  targetLabel: string | null;
  baselineTimeSec: number;
  baselineProbabilityPct: number | null;
  scenarios: GoalScenario[];
  recommendation: string;
  confidence: "low" | "medium" | "high";
  evidence: string[];
  limitations: string[];
}

const LONG_RUN_TARGET_KM: Record<NonNullable<RaceForecastInput["goal"]["distanceKey"]>, number> = {
  "5k": 8,
  "10k": 12,
  hm: 18,
  marathon: 32,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * P(finish ≤ target) as a percent. The interval is a percentile ladder over
 * race times (smaller time = faster), so probability rises as the target time
 * grows. Piecewise-linear across p10–p90 with linear extrapolation at the ends,
 * clamped to [2, 98].
 */
export function probabilityOfTarget(
  targetSec: number,
  interval: RaceForecastV2["predictionIntervalSec"],
): number {
  const xs = [interval.p10, interval.p25, interval.p50, interval.p75, interval.p90];
  const ys = [10, 25, 50, 75, 90];

  // Below the fastest anchor — extrapolate using the first segment's slope.
  if (targetSec <= xs[0]) {
    const slope = (ys[1] - ys[0]) / Math.max(1, xs[1] - xs[0]);
    return clamp(ys[0] - slope * (xs[0] - targetSec), 2, 98);
  }
  // Above the slowest anchor — extrapolate using the last segment's slope.
  if (targetSec >= xs[xs.length - 1]) {
    const n = xs.length - 1;
    const slope = (ys[n] - ys[n - 1]) / Math.max(1, xs[n] - xs[n - 1]);
    return clamp(ys[n] + slope * (targetSec - xs[n]), 2, 98);
  }
  for (let i = 0; i < xs.length - 1; i++) {
    if (targetSec >= xs[i] && targetSec <= xs[i + 1]) {
      const t = (targetSec - xs[i]) / Math.max(1, xs[i + 1] - xs[i]);
      return clamp(ys[i] + t * (ys[i + 1] - ys[i]), 2, 98);
    }
  }
  return 50;
}

function applyLever(input: RaceForecastInput, lever: GoalLever): RaceForecastInput {
  const recentBlocks = input.recentBlocks.map((b) => ({
    ...b,
    distanceKm: round1(b.distanceKm * lever.volumeMultiplier),
    longestRunKm:
      lever.longRunKm != null ? Math.max(b.longestRunKm, lever.longRunKm) : b.longestRunKm,
  }));
  const baseHard = input.athleteContext?.hardRunsLast14d ?? 0;
  return {
    ...input,
    recentBlocks,
    athleteContext: {
      ...input.athleteContext,
      hardRunsLast14d: baseHard + lever.extraQualityPerWeek * 2,
    },
  };
}

function mapConfidence(c: RaceForecastV2["confidence"]): "low" | "medium" | "high" {
  if (c === "high" || c === "medium_high") return "high";
  if (c === "medium") return "medium";
  return "low";
}

export function computeGoalScenarios(input: RaceForecastInput): GoalScenarioResult {
  const baseline = buildRaceForecastV2(input);
  const targetTimeSec = input.goal.targetTimeSec ?? null;
  const hasTarget = targetTimeSec != null;
  const confidence = mapConfidence(baseline.confidence);

  const currentWeeklyKm =
    input.recentBlocks.length > 0
      ? round1(input.recentBlocks[input.recentBlocks.length - 1].distanceKm / 4)
      : 0;
  const currentQualityPerWeek = Math.round((input.athleteContext?.hardRunsLast14d ?? 0) / 2);
  const longRunTargetKm = input.goal.distanceKey
    ? LONG_RUN_TARGET_KM[input.goal.distanceKey]
    : null;

  const prob = (f: RaceForecastV2): number | null =>
    hasTarget ? Math.round(probabilityOfTarget(targetTimeSec!, f.predictionIntervalSec)) : null;

  const baselineProbabilityPct = prob(baseline);

  const volSummary = (mult: number) =>
    `${mult > 1 ? "+" : ""}${Math.round((mult - 1) * 100)}% volume (~${round1(currentWeeklyKm * mult)} km/wk)`;

  const specs: {
    id: string;
    label: string;
    lever: GoalLever;
    parts: string[];
    rationale: string[];
  }[] = [
    {
      id: "maintain",
      label: "Maintain current training",
      lever: { volumeMultiplier: 1, extraQualityPerWeek: 0, longRunKm: null },
      parts: [`Hold ~${currentWeeklyKm} km/wk`, `${currentQualityPerWeek} quality/wk`],
      rationale: ["Your current training, projected forward with no change."],
    },
    {
      id: "volume",
      label: "Build volume",
      lever: { volumeMultiplier: 1.12, extraQualityPerWeek: 0, longRunKm: null },
      parts: [volSummary(1.12)],
      rationale: ["A sustained ~12% lift in weekly volume strengthens the aerobic base."],
    },
    {
      id: "quality",
      label: "Add quality",
      lever: { volumeMultiplier: 1, extraQualityPerWeek: 1, longRunKm: null },
      parts: [`+1 quality/wk (${currentQualityPerWeek + 1} total)`],
      rationale: ["One more threshold/interval session per week sharpens race-specific fitness."],
    },
    {
      id: "full-block",
      label: "Full training block",
      lever: { volumeMultiplier: 1.12, extraQualityPerWeek: 1, longRunKm: longRunTargetKm },
      parts: [
        volSummary(1.12),
        `+1 quality/wk`,
        ...(longRunTargetKm ? [`long run → ~${longRunTargetKm} km`] : []),
      ],
      rationale: [
        "Volume, quality, and long-run specificity together — the strongest realistic lever.",
      ],
    },
  ];

  const scenarios: GoalScenario[] = specs.map((s) => {
    const forecast =
      s.id === "maintain" ? baseline : buildRaceForecastV2(applyLever(input, s.lever));
    const p = prob(forecast);
    return {
      id: s.id,
      label: s.label,
      leverSummary: s.parts.join(" · "),
      projectedTimeSec: forecast.mostLikelyTimeSec,
      projectedTimeLabel: formatDuration(forecast.mostLikelyTimeSec),
      probabilityPct: p,
      meetsTarget: p != null && p >= LIKELY_PCT,
      rationale: s.rationale,
    };
  });

  const recommendation = buildRecommendation(
    hasTarget,
    targetTimeSec,
    baselineProbabilityPct,
    scenarios,
    baseline,
  );

  const evidence = [
    `Baseline projection ${formatDuration(baseline.mostLikelyTimeSec)} (${baseline.confidence.replace("_", " ")} confidence)`,
    `Current load ~${currentWeeklyKm} km/wk, ${currentQualityPerWeek} quality session${currentQualityPerWeek === 1 ? "" : "s"}/wk`,
    `Prediction corridor ${formatDuration(baseline.predictionIntervalSec.p25)}–${formatDuration(baseline.predictionIntervalSec.p75)} (p25–p75)`,
  ];

  const limitations: string[] = [];
  if (!hasTarget) limitations.push("No target time set — set one to see probabilities.");
  if (input.efforts.length < 3)
    limitations.push("Few race-quality efforts on record; projections are lower-confidence.");
  if (baseline.confidence === "low")
    limitations.push("Forecast confidence is low; treat scenario probabilities as directional.");

  return {
    hasTarget,
    targetTimeSec,
    targetLabel: hasTarget ? formatDuration(targetTimeSec!) : null,
    baselineTimeSec: baseline.mostLikelyTimeSec,
    baselineProbabilityPct,
    scenarios,
    recommendation,
    confidence,
    evidence,
    limitations,
  };
}

/** Adapter: build scenarios straight from the analytics bundle (view-model + page). */
export function buildGoalScenariosView(opts: {
  analytics: DashboardInsights;
  goal: RaceGoal | null;
  runs?: RunActivity[];
  fitDetails?: FitRunDetail[];
}): GoalScenarioResult | null {
  const input = buildRaceForecastInput(opts);
  if (!input || input.efforts.length === 0) return null;
  return computeGoalScenarios(input);
}

function buildRecommendation(
  hasTarget: boolean,
  targetTimeSec: number | null,
  baselineProbabilityPct: number | null,
  scenarios: GoalScenario[],
  baseline: RaceForecastV2,
): string {
  if (!hasTarget) {
    return "Set a target time on your goal to see the probability of hitting it and the training changes that would move the needle.";
  }
  const target = formatDuration(targetTimeSec!);
  if (baselineProbabilityPct != null && baselineProbabilityPct >= LIKELY_PCT) {
    return `You're on track for ${target} — current training projects a ${baselineProbabilityPct}% chance. Hold specificity and freshness through race day.`;
  }
  // Least-effort scenario (ladder order) that reaches "likely".
  const lift = scenarios.find((s) => s.id !== "maintain" && s.meetsTarget);
  if (lift) {
    return `${target} looks reachable with "${lift.label}" (${lift.leverSummary}) — that raises the estimate from ${baselineProbabilityPct}% to ${lift.probabilityPct}%.`;
  }
  const best = scenarios[scenarios.length - 1];
  return `${target} is a stretch — even a full training block projects only ${best.probabilityPct}%. Consider a more conservative target near ${formatDuration(baseline.predictionIntervalSec.p50)} or a later race date.`;
}
