export const MAX_STREAM_POINTS = 80;
/** GPS route replay — higher fidelity for map geometry */
export const MAX_GPS_POINTS = 500;

export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  if (max <= 0) return [];
  // `step` divides by `max - 1`, so a request for a single point produced
  // `Math.round(0 * Infinity)` — NaN — and returned `[undefined]`: a hole rather than
  // a sample. Not reachable from the current callers (80 and 500), but a function
  // that returns a hole for a legal argument is a trap for the next one.
  if (max === 1) return [points[0]];
  const out: T[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}
