/** Generic stream interpolation — decoupled from Strava/FIT. */

export function interpolateAtTime<T extends { elapsedSec: number }>(
  stream: T[],
  t: number,
  pick: (p: T) => number | null,
): number | null {
  if (stream.length === 0) return null;
  if (t <= stream[0].elapsedSec) return pick(stream[0]);
  const last = stream[stream.length - 1];
  if (t >= last.elapsedSec) return pick(last);

  for (let i = 0; i < stream.length - 1; i++) {
    const a = stream[i];
    const b = stream[i + 1];
    if (t >= a.elapsedSec && t <= b.elapsedSec) {
      const va = pick(a);
      const vb = pick(b);
      if (va == null) return vb;
      if (vb == null) return va;
      const ratio = (t - a.elapsedSec) / Math.max(0.001, b.elapsedSec - a.elapsedSec);
      return va + (vb - va) * ratio;
    }
  }
  return pick(last);
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
