import type { RunActivity } from "@/lib/strava/types";
import { paceSecPerKm } from "./pace";

/**
 * D5 — Honest correlation explorer (Pillar 4).
 *
 * Surfaces associations between the athlete's own metrics — cadence vs
 * efficiency, prior-week load vs performance, heat vs pace — with r and sample
 * size. The honesty is the feature: strength is classified conservatively, tiny
 * samples are suppressed, and every finding is phrased as an association with a
 * standing "not causation; confounders overlap" caveat. We never claim a cause.
 */

export type CorrelationStrength = "none" | "weak" | "moderate" | "strong";

export interface Correlation {
  key: string;
  label: string;
  r: number;
  n: number;
  strength: CorrelationStrength;
  direction: "positive" | "negative" | "none";
  interpretation: string;
  caveat: string;
}

export interface CorrelationReport {
  available: boolean;
  correlations: Correlation[];
  evidence: string[];
  limitations: string[];
}

/** Minimum paired observations before a correlation is worth reporting. */
const MIN_N = 8;

const CAUSATION_CAVEAT =
  "Associations in your own data — not causation; weather, terrain, and fatigue overlap as confounders.";

/** Pearson r; null when n is too small or either variable has no spread. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx < 1e-9 || vy < 1e-9) return null;
  const r = cov / Math.sqrt(vx * vy);
  return Math.max(-1, Math.min(1, r));
}

function efficiencyOf(run: RunActivity): number | null {
  const pace = paceSecPerKm(run);
  if (pace == null || run.avgHr == null || run.avgHr < 80) return null;
  return pace / run.avgHr;
}

/** Km run in the 7 days strictly before `dateIso` (excluding the run itself). */
function priorWeekKm(runs: RunActivity[], dateIso: string, excludeId: string): number {
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return 0;
  const start = t - 7 * 86_400_000;
  let km = 0;
  for (const r of runs) {
    if (r.id === excludeId) continue;
    const rt = Date.parse(r.date);
    if (!Number.isNaN(rt) && rt < t && rt >= start) km += r.distanceM / 1000;
  }
  return km;
}

interface PairSpec {
  key: string;
  label: string;
  x: (run: RunActivity, runs: RunActivity[]) => number | null;
  y: (run: RunActivity, runs: RunActivity[]) => number | null;
  /** Plain reading when r is positive / negative (baked var-direction, no cause claim). */
  positiveMeans: string;
  negativeMeans: string;
}

const PAIRS: PairSpec[] = [
  {
    key: "cadence_efficiency",
    label: "Cadence vs efficiency",
    x: (r) => (r.avgCadence != null && r.avgCadence > 0 ? r.avgCadence : null),
    y: (r) => efficiencyOf(r),
    // efficiency index is lower-is-better
    positiveMeans: "higher cadence tends to go with worse efficiency",
    negativeMeans: "higher cadence tends to go with better efficiency",
  },
  {
    key: "priorload_efficiency",
    label: "Prior-week load vs efficiency",
    x: (r, runs) => priorWeekKm(runs, r.date, r.id),
    y: (r) => efficiencyOf(r),
    positiveMeans: "heavier recent load tends to go with worse efficiency",
    negativeMeans: "heavier recent load tends to go with better efficiency",
  },
  {
    key: "priorload_pace",
    label: "Prior-week load vs pace",
    x: (r, runs) => priorWeekKm(runs, r.date, r.id),
    y: (r) => paceSecPerKm(r),
    // pace sec/km is lower-is-better
    positiveMeans: "heavier recent load tends to go with slower runs",
    negativeMeans: "heavier recent load tends to go with faster runs",
  },
  {
    key: "temp_pace",
    label: "Temperature vs pace",
    x: (r) => (r.weatherTempC != null ? r.weatherTempC : null),
    y: (r) => paceSecPerKm(r),
    positiveMeans: "hotter days tend to be slower",
    negativeMeans: "hotter days tend to be faster",
  },
];

function strengthOf(r: number): CorrelationStrength {
  const a = Math.abs(r);
  if (a < 0.2) return "none";
  if (a < 0.4) return "weak";
  if (a < 0.6) return "moderate";
  return "strong";
}

export function computeCorrelations(runs: RunActivity[]): CorrelationReport {
  const correlations: Correlation[] = [];

  for (const spec of PAIRS) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const run of runs) {
      const x = spec.x(run, runs);
      const y = spec.y(run, runs);
      if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      // prior-week 0 is a legitimate observation, so keep it.
      xs.push(x);
      ys.push(y);
    }
    if (xs.length < MIN_N) continue;
    const rRaw = pearson(xs, ys);
    if (rRaw == null) continue;
    const r = Math.round(rRaw * 100) / 100;
    const strength = strengthOf(r);
    const direction = strength === "none" ? "none" : r > 0 ? "positive" : "negative";

    const reading =
      strength === "none"
        ? "no meaningful association"
        : r > 0
          ? spec.positiveMeans
          : spec.negativeMeans;

    const caveatParts = ["association, not causation"];
    if (xs.length < 15) caveatParts.push(`small sample (n=${xs.length})`);
    if (strength === "none") caveatParts.push("negligible");

    correlations.push({
      key: spec.key,
      label: spec.label,
      r,
      n: xs.length,
      strength,
      direction,
      interpretation: `${spec.label}: ${strength === "none" ? "no meaningful association" : `${strength} ${direction}`} (r=${r.toFixed(2)}, n=${xs.length}) — ${reading}.`,
      caveat: caveatParts.join("; "),
    });
  }

  correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  if (correlations.length === 0) {
    return {
      available: false,
      correlations: [],
      evidence: [],
      limitations: [
        `Need at least ${MIN_N} runs with the relevant fields (cadence, HR, weather) to explore correlations.`,
      ],
    };
  }

  const meaningful = correlations.filter((c) => c.strength !== "none");
  return {
    available: true,
    correlations,
    evidence: (meaningful.length > 0 ? meaningful : correlations)
      .slice(0, 3)
      .map((c) => c.interpretation),
    limitations: [CAUSATION_CAVEAT],
  };
}
