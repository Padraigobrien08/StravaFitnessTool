import type { RunActivity } from "@/lib/strava/types";
import { aerobicEfficiencyTrend } from "./efficiency";
import { weeklyVolume } from "./volume";
import { paceSecPerKm } from "./pace";
import { bootstrapMeanCI, type BootstrapCI } from "./bootstrap";
import type { RunWorkoutLabel, WorkoutType } from "./workoutType";

/**
 * D1 — Uncertainty everywhere (Pillar 4).
 *
 * Turns descriptive point metrics ("current efficiency", "typical weekly
 * volume") into intervals by bootstrapping the athlete's own recent runs — the
 * same honesty the race forecaster already applies to predictions, extended to
 * the everyday numbers. Each estimate reports its CI level, sample size, and a
 * plain reading; too few samples → no estimate rather than false precision.
 */

export interface UncertaintyEstimate {
  key: "aerobic_efficiency" | "weekly_volume" | "easy_pace";
  label: string;
  unit: string;
  point: number;
  lo: number;
  hi: number;
  ciPct: number;
  n: number;
  confidence: "low" | "medium" | "high";
  interpretation: string;
}

export interface UncertaintyEstimates {
  available: boolean;
  estimates: UncertaintyEstimate[];
  evidence: string[];
  limitations: string[];
}

const RECENT_DAYS = 56;
const CI_PCT = 90;

function confidenceFor(n: number): "low" | "medium" | "high" {
  if (n >= 12) return "high";
  if (n >= 8) return "medium";
  return "low";
}

/** Keep items whose date is within `days` of the most recent item's date. */
function recentByDate<T>(items: T[], getDate: (t: T) => string, days = RECENT_DAYS): T[] {
  const times = items.map((t) => Date.parse(getDate(t))).filter((n) => !Number.isNaN(n));
  if (times.length === 0) return [];
  const maxT = Math.max(...times);
  const cutoff = maxT - days * 86_400_000;
  return items.filter((t) => {
    const dt = Date.parse(getDate(t));
    return !Number.isNaN(dt) && dt >= cutoff;
  });
}

function paceLabel(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

function build(
  key: UncertaintyEstimate["key"],
  label: string,
  unit: string,
  ci: BootstrapCI,
  interpretation: string,
): UncertaintyEstimate {
  return {
    key,
    label,
    unit,
    point: ci.point,
    lo: ci.lo,
    hi: ci.hi,
    ciPct: ci.ciPct,
    n: ci.n,
    confidence: confidenceFor(ci.n),
    interpretation,
  };
}

export function computeUncertaintyEstimates(
  runs: RunActivity[],
  workoutLabels: RunWorkoutLabel[],
): UncertaintyEstimates {
  const estimates: UncertaintyEstimate[] = [];

  // Aerobic efficiency (pace/HR) — lower is better.
  const effPoints = recentByDate(aerobicEfficiencyTrend(runs), (p) => p.date);
  const effCi = bootstrapMeanCI(
    effPoints.map((p) => p.efficiency),
    { ciPct: CI_PCT },
  );
  if (effCi) {
    estimates.push(
      build(
        "aerobic_efficiency",
        "Aerobic efficiency",
        "pace/HR",
        effCi,
        `Current aerobic efficiency ${effCi.point.toFixed(3)} (pace ÷ HR; lower = better), ${CI_PCT}% CI ${effCi.lo.toFixed(3)}–${effCi.hi.toFixed(3)} across ${effCi.n} recent runs.`,
      ),
    );
  }

  // Weekly volume (km/wk).
  const volPoints = recentByDate(weeklyVolume(runs), (w) => w.weekStart);
  const volCi = bootstrapMeanCI(
    volPoints.map((w) => w.distanceKm),
    { ciPct: CI_PCT },
  );
  if (volCi) {
    estimates.push(
      build(
        "weekly_volume",
        "Weekly volume",
        "km/wk",
        volCi,
        `Typical weekly volume ~${Math.round(volCi.point)} km, ${CI_PCT}% CI ${Math.round(volCi.lo)}–${Math.round(volCi.hi)} km across ${volCi.n} recent weeks.`,
      ),
    );
  }

  // Easy-run pace (sec/km) — cohort of easy/recovery runs.
  const easyTypes = new Set<WorkoutType>(["easy", "recovery"]);
  const easyIds = new Set(
    workoutLabels.filter((l) => easyTypes.has(l.classification.type)).map((l) => l.runId),
  );
  const easyRuns = recentByDate(
    runs.filter((r) => easyIds.has(r.id)),
    (r) => r.date,
  );
  const easyPaces = easyRuns
    .map((r) => paceSecPerKm(r))
    .filter((p): p is number => p != null && p > 0);
  const paceCi = bootstrapMeanCI(easyPaces, { ciPct: CI_PCT });
  if (paceCi) {
    estimates.push(
      build(
        "easy_pace",
        "Easy-run pace",
        "/km",
        paceCi,
        `Easy-run pace around ${paceLabel(paceCi.point)}, ${CI_PCT}% CI ${paceLabel(paceCi.hi)}–${paceLabel(paceCi.lo)} across ${paceCi.n} recent easy runs.`,
      ),
    );
  }

  if (estimates.length === 0) {
    return {
      available: false,
      estimates: [],
      evidence: [],
      limitations: [
        "Need at least 5 recent runs (or weeks) of a metric to bootstrap a confidence interval.",
      ],
    };
  }

  const lowN = estimates.filter((e) => e.confidence === "low").length;
  const limitations: string[] = [];
  if (lowN > 0) {
    limitations.push(
      `${lowN} estimate${lowN === 1 ? "" : "s"} rest on a small recent sample (<8): the interval is wide for a reason.`,
    );
  }

  return {
    available: true,
    estimates,
    evidence: estimates.map((e) => e.interpretation),
    limitations,
  };
}
