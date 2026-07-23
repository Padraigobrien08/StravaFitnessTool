import type { FitnessIndexPoint } from "./trainingLoad";

/**
 * D2 — Change-point detection (Pillar 4, data-scientist rigor).
 *
 * Auto-finds where the athlete's fitness trajectory (weekly CTL) changes slope
 * — a build that took hold, a peak, a break or a setback — and names each
 * inflection in plain language. Deterministic and explainable: a slope-delta
 * scan with non-maximum suppression, no heavy dependencies. Change-points are
 * descriptive markers on the curve, not diagnoses.
 */

export type ChangePointKind = "reversal_up" | "reversal_down" | "acceleration" | "deceleration";

export interface ChangePoint {
  weekStart: string;
  label: string;
  kind: ChangePointKind;
  /** OLS slope (units/week) over the window before / after the point. */
  slopeBefore: number;
  slopeAfter: number;
  deltaPerWeek: number;
  interpretation: string;
}

export interface ChangePointReport {
  available: boolean;
  metricLabel: string;
  changePoints: ChangePoint[];
  evidence: string[];
  limitations: string[];
}

export interface ChangePointSeriesPoint {
  weekStart: string;
  label: string;
  value: number;
}

export interface ChangePointOpts {
  /** Points required on each side of a candidate. */
  minSeg?: number;
  /** Window width used for the before/after slope fit. */
  window?: number;
  /** Minimum |slope delta| (units/week) to count as a change-point. */
  minDelta?: number;
  /** Minimum index separation between accepted points (NMS). */
  minSeparation?: number;
  /** Cap on returned change-points. */
  maxPoints?: number;
}

/** OLS slope of values over integer x = 0..n-1. */
function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - mx;
    cov += dx * (values[i] - my);
    vx += dx * dx;
  }
  return vx < 1e-9 ? 0 : cov / vx;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const FLAT = 0.3;

function classify(before: number, after: number): ChangePointKind {
  if (before < -FLAT && after > FLAT) return "reversal_up";
  if (before > FLAT && after < -FLAT) return "reversal_down";
  return after > before ? "acceleration" : "deceleration";
}

function interpret(kind: ChangePointKind, label: string, before: number, after: number): string {
  const shift = `slope ${before >= 0 ? "+" : ""}${before}→${after >= 0 ? "+" : ""}${after}/wk`;
  switch (kind) {
    case "reversal_up":
      return `Fitness turned upward around ${label} — a build phase took hold (${shift}).`;
    case "reversal_down":
      return after < -1
        ? `Fitness dropped sharply around ${label} — a break or setback (${shift}).`
        : `Fitness peaked and eased off around ${label} — taper or a lighter stretch (${shift}).`;
    case "acceleration":
      return `Fitness ramp steepened around ${label} (${shift}).`;
    case "deceleration":
      return `Fitness gains flattened around ${label} (${shift}).`;
  }
}

export function detectChangePoints(
  series: ChangePointSeriesPoint[],
  opts: ChangePointOpts = {},
): ChangePoint[] {
  const minSeg = opts.minSeg ?? 3;
  const window = opts.window ?? 4;
  const minDelta = opts.minDelta ?? 1;
  const minSeparation = opts.minSeparation ?? 3;
  const maxPoints = opts.maxPoints ?? 5;

  const n = series.length;
  if (n < 2 * minSeg + 1) return [];

  const values = series.map((p) => p.value);
  const candidates: { i: number; before: number; after: number; delta: number }[] = [];
  for (let i = minSeg; i <= n - 1 - minSeg; i++) {
    const before = slope(values.slice(Math.max(0, i - window), i + 1));
    const after = slope(values.slice(i, Math.min(n, i + window + 1)));
    const delta = after - before;
    if (Math.abs(delta) >= minDelta) candidates.push({ i, before, after, delta });
  }

  // Non-maximum suppression: strongest deltas first, keep minSeparation apart.
  candidates.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const chosen: typeof candidates = [];
  for (const c of candidates) {
    if (chosen.some((k) => Math.abs(k.i - c.i) < minSeparation)) continue;
    chosen.push(c);
    if (chosen.length >= maxPoints) break;
  }

  return chosen
    .sort((a, b) => a.i - b.i)
    .map((c) => {
      const before = round2(c.before);
      const after = round2(c.after);
      const kind = classify(before, after);
      const pt = series[c.i];
      return {
        weekStart: pt.weekStart,
        label: pt.label,
        kind,
        slopeBefore: before,
        slopeAfter: after,
        deltaPerWeek: round2(c.delta),
        interpretation: interpret(kind, pt.label, before, after),
      };
    });
}

export function computeFitnessChangePoints(fitnessIndex: FitnessIndexPoint[]): ChangePointReport {
  const series: ChangePointSeriesPoint[] = fitnessIndex.map((p) => ({
    weekStart: p.weekStart,
    label: p.label,
    value: p.ctl,
  }));

  if (series.length < 8) {
    return {
      available: false,
      metricLabel: "Fitness (CTL)",
      changePoints: [],
      evidence: [],
      limitations: [
        "Need at least ~8 weeks of training history to detect fitness-trajectory change-points.",
      ],
    };
  }

  const changePoints = detectChangePoints(series);
  if (changePoints.length === 0) {
    return {
      available: false,
      metricLabel: "Fitness (CTL)",
      changePoints: [],
      evidence: [],
      limitations: ["No clear slope changes in your fitness trajectory over this window."],
    };
  }

  return {
    available: true,
    metricLabel: "Fitness (CTL)",
    changePoints,
    evidence: changePoints.map((c) => c.interpretation),
    limitations: [
      "CTL is a load-based fitness proxy; change-points mark slope shifts in it, and are descriptive, not diagnoses.",
    ],
  };
}
