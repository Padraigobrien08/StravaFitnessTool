import type { FitLap } from "@/lib/strava/fitTypes";

export interface BestEffortResult {
  key: string;
  label: string;
  distanceM: number;
  timeSec: number;
  paceSecPerKm: number;
  startElapsedSec: number;
  source: "segment" | "laps";
}

export const BEST_EFFORT_TARGETS = [
  { key: "5k", label: "5K", distanceM: 5000 },
  { key: "10k", label: "10K", distanceM: 10000 },
  { key: "hm", label: "Half Marathon", distanceM: 21097.5 },
] as const;

interface DistancePoint {
  elapsedSec: number;
  distanceM: number;
}

/** Build cumulative distance from pace samples (speed = 1000/pace m/s). */
function buildDistanceSeries(
  stream: { elapsedSec: number; paceSecPerKm: number }[],
): DistancePoint[] {
  if (stream.length < 2) return [];
  const out: DistancePoint[] = [{ elapsedSec: stream[0].elapsedSec, distanceM: 0 }];
  for (let i = 1; i < stream.length; i++) {
    const dt = stream[i].elapsedSec - stream[i - 1].elapsedSec;
    if (dt <= 0) continue;
    const p1 = stream[i - 1].paceSecPerKm;
    const p2 = stream[i].paceSecPerKm;
    if (p1 <= 0 || p2 <= 0 || p1 > 1200 || p2 > 1200) continue;
    const speed1 = 1000 / p1;
    const speed2 = 1000 / p2;
    const dist = ((speed1 + speed2) / 2) * dt;
    out.push({
      elapsedSec: stream[i].elapsedSec,
      distanceM: out[out.length - 1].distanceM + dist,
    });
  }
  return out;
}

/** Fastest time to cover at least targetDistanceM along the run. */
export function bestEffortFromPaceStream(
  stream: { elapsedSec: number; paceSecPerKm: number }[],
  targetDistanceM: number,
  key: string,
  label: string,
): BestEffortResult | null {
  const series = buildDistanceSeries(stream);
  if (series.length < 2) return null;
  const totalDist = series[series.length - 1].distanceM;
  if (totalDist < targetDistanceM * 0.95) return null;

  let best: BestEffortResult | null = null;

  for (let start = 0; start < series.length; start++) {
    const startDist = series[start].distanceM;
    const startTime = series[start].elapsedSec;

    for (let end = start + 1; end < series.length; end++) {
      const segDist = series[end].distanceM - startDist;
      if (segDist < targetDistanceM) continue;

      const timeSec = series[end].elapsedSec - startTime;
      if (timeSec <= 0) break;

      const paceSecPerKm = timeSec / (targetDistanceM / 1000);
      if (!best || timeSec < best.timeSec) {
        best = {
          key,
          label,
          distanceM: targetDistanceM,
          timeSec,
          paceSecPerKm,
          startElapsedSec: startTime,
          source: "segment",
        };
      }
      break;
    }
  }

  return best;
}

/** Best contiguous lap block approximating target distance (interval sessions). */
export function bestEffortFromLaps(
  laps: FitLap[],
  targetDistanceM: number,
  key: string,
  label: string,
): BestEffortResult | null {
  const valid = laps.filter(
    (l) => l.distanceM != null && l.distanceM > 100 && l.timeSec != null && l.timeSec > 0,
  );
  if (valid.length === 0) return null;

  let best: BestEffortResult | null = null;

  for (let i = 0; i < valid.length; i++) {
    let dist = 0;
    let time = 0;
    for (let j = i; j < valid.length; j++) {
      dist += valid[j].distanceM!;
      time += valid[j].timeSec!;
      if (dist >= targetDistanceM * 0.9 && dist <= targetDistanceM * 1.15) {
        const paceSecPerKm = time / (dist / 1000);
        if (!best || time < best.timeSec) {
          best = {
            key,
            label,
            distanceM: dist,
            timeSec: time,
            paceSecPerKm,
            startElapsedSec: 0,
            source: "laps",
          };
        }
      }
      if (dist > targetDistanceM * 1.2) break;
    }
  }

  return best;
}

export function computeAllBestEfforts(
  paceStream: { elapsedSec: number; paceSecPerKm: number }[],
  laps: FitLap[],
): BestEffortResult[] {
  const results: BestEffortResult[] = [];

  for (const t of BEST_EFFORT_TARGETS) {
    const fromStream = bestEffortFromPaceStream(paceStream, t.distanceM, t.key, t.label);
    const fromLaps = bestEffortFromLaps(laps, t.distanceM, t.key, t.label);

    const candidates = [fromStream, fromLaps].filter((c): c is BestEffortResult => c !== null);
    if (candidates.length === 0) continue;

    const best = candidates.reduce((a, b) => (a.timeSec < b.timeSec ? a : b));
    results.push(best);
  }

  return results;
}
