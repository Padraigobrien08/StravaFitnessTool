/** Min–max Y domain with padding; optional IQR outlier drop for display scales. */
export function minMaxYDomain(
  values: number[],
  opts?: {
    paddingPct?: number;
    paddingMin?: number;
    filterOutliers?: boolean;
  },
): [number, number] {
  let vals = values.filter((v) => Number.isFinite(v) && v > 0);
  if (vals.length === 0) return [0, 1];

  if (opts?.filterOutliers !== false && vals.length >= 4) {
    const sorted = [...vals].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
    const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
    const iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    const filtered = vals.filter((v) => v >= lo && v <= hi);
    if (filtered.length >= 2) vals = filtered;
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, min * 0.02, 30);
  const pad = Math.max(opts?.paddingMin ?? 20, span * (opts?.paddingPct ?? 0.1));

  return [min - pad, max + pad];
}

/** Reversed axis (pace): faster = lower sec = top of chart → domain [high, low]. */
export function minMaxYDomainReversed(
  values: number[],
  opts?: Parameters<typeof minMaxYDomain>[1],
): [number, number] {
  const [lo, hi] = minMaxYDomain(values, opts);
  return [hi, lo];
}
