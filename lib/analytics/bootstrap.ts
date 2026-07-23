/**
 * D1 — Bootstrap confidence intervals (Pillar 4, data-scientist rigor).
 *
 * A reusable primitive for "intervals not points": resample the athlete's own
 * observations with replacement, recompute a statistic each time, and read a
 * percentile confidence interval off the resampled distribution. No parametric
 * assumptions — the interval reflects the spread actually present in their data.
 *
 * Deterministic by design: a seeded PRNG means the same inputs always yield the
 * same interval (stable across renders, and unit-testable). This is app code,
 * so a local RNG is fine — the seed is for reproducibility, not secrecy.
 */

export interface BootstrapCI {
  /** The statistic on the observed sample. */
  point: number;
  /** Lower / upper percentile bound of the resampled distribution. */
  lo: number;
  hi: number;
  /** Confidence level (e.g. 90). */
  ciPct: number;
  /** Observed sample size. */
  n: number;
  iterations: number;
}

export interface BootstrapOpts {
  iterations?: number;
  ciPct?: number;
  seed?: number;
  /** Minimum observations required to bootstrap; below this returns null. */
  minN?: number;
}

/** mulberry32 — tiny deterministic PRNG in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Percentile (0–100) of a sorted-in-place copy via linear interpolation. */
function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Bootstrap CI for an arbitrary statistic over `values`. Returns null when the
 * sample is too small to resample meaningfully (`minN`, default 5).
 */
export function bootstrapCI(
  values: number[],
  statistic: (xs: number[]) => number,
  opts: BootstrapOpts = {},
): BootstrapCI | null {
  const clean = values.filter((v) => Number.isFinite(v));
  const n = clean.length;
  const minN = opts.minN ?? 5;
  if (n < minN) return null;

  const iterations = opts.iterations ?? 1000;
  const ciPct = opts.ciPct ?? 90;
  const rand = mulberry32(opts.seed ?? 0x9e3779b9);

  const stats: number[] = [];
  const sample = new Array<number>(n);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      sample[i] = clean[Math.floor(rand() * n)];
    }
    stats.push(statistic(sample));
  }

  const alpha = (100 - ciPct) / 2;
  return {
    point: round2(statistic(clean)),
    lo: round2(percentile(stats, alpha)),
    hi: round2(percentile(stats, 100 - alpha)),
    ciPct,
    n,
    iterations,
  };
}

/** Convenience: bootstrap CI of the mean. */
export function bootstrapMeanCI(values: number[], opts: BootstrapOpts = {}): BootstrapCI | null {
  return bootstrapCI(values, mean, opts);
}
