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

/** Float-noise tolerance on distance comparisons, in metres. */
const EPSILON_M = 1;

interface DistancePoint {
  elapsedSec: number;
  distanceM: number;
}

/**
 * Build cumulative distance from pace samples (speed = 1000/pace m/s).
 *
 * Integrating pace accumulates error, and samples dropped by the guards below
 * are simply lost, so the total can drift a long way from the distance actually
 * covered. Measured across 73 real activities: median drift −0.1%, but a tail
 * reaching **+24%** — one 4.02 km run integrated to 4.99 km, which is enough to
 * manufacture a "5K best effort" from a run that never reached 5 km.
 *
 * When the true total is known (it always is: it comes from the activity), the
 * series is scaled to match. That anchors both endpoints and distributes the
 * residual error, rather than letting it pile up.
 */
function buildDistanceSeries(
  stream: { elapsedSec: number; paceSecPerKm: number }[],
  totalDistanceM?: number,
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

  const integrated = out[out.length - 1]?.distanceM ?? 0;
  if (totalDistanceM && totalDistanceM > 0 && integrated > 0) {
    const k = totalDistanceM / integrated;
    return out.map((p) => ({ ...p, distanceM: p.distanceM * k }));
  }
  return out;
}

/** Fastest time to cover at least targetDistanceM along the run. */
export function bestEffortFromPaceStream(
  stream: { elapsedSec: number; paceSecPerKm: number }[],
  targetDistanceM: number,
  key: string,
  label: string,
  totalDistanceM?: number,
): BestEffortResult | null {
  const series = buildDistanceSeries(stream, totalDistanceM);
  if (series.length < 2) return null;
  const totalDist = series[series.length - 1].distanceM;
  // A run shorter than the target cannot contain the target. The old 5% of
  // slack here was harmless only because the inner loop is strict; with the
  // series now anchored to the true distance there is no reason to keep it.
  // One metre of tolerance, purely so a run measured at exactly the target is
  // not rejected by floating-point noise in the integration.
  if (totalDist < targetDistanceM - EPSILON_M) return null;

  let best: BestEffortResult | null = null;

  for (let start = 0; start < series.length; start++) {
    const startDist = series[start].distanceM;
    const startTime = series[start].elapsedSec;

    for (let end = start + 1; end < series.length; end++) {
      const segDist = series[end].distanceM - startDist;
      if (segDist < targetDistanceM - EPSILON_M) continue;

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
        // The block is only approximately the target, so its raw time is not a
        // time for the target: a 4.5 km block was being reported as a 5K. Hold
        // the measured pace and state the time the target would take at it.
        const timeAtTarget = Math.round(paceSecPerKm * (targetDistanceM / 1000));
        if (!best || timeAtTarget < best.timeSec) {
          best = {
            key,
            label,
            distanceM: dist,
            timeSec: timeAtTarget,
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

/**
 * Distance to anchor the pace integration against.
 *
 * Lap distances come from the device rather than from integrating pace, so
 * their sum is an independent measure of how far the activity actually went.
 * Callers may pass the activity total directly; otherwise this recovers it,
 * which keeps the correction working without threading it through every caller.
 */
function anchorDistanceM(laps: FitLap[], provided?: number): number | undefined {
  if (provided && provided > 0) return provided;
  const summed = laps.reduce((s, l) => s + (l.distanceM ?? 0), 0);
  return summed > 0 ? summed : undefined;
}

export function computeAllBestEfforts(
  paceStream: { elapsedSec: number; paceSecPerKm: number }[],
  laps: FitLap[],
  /** The activity's true distance, used to anchor the integrated pace stream. */
  totalDistanceM?: number,
): BestEffortResult[] {
  const results: BestEffortResult[] = [];
  const anchor = anchorDistanceM(laps, totalDistanceM);

  for (const t of BEST_EFFORT_TARGETS) {
    const fromStream = bestEffortFromPaceStream(paceStream, t.distanceM, t.key, t.label, anchor);
    const fromLaps = bestEffortFromLaps(laps, t.distanceM, t.key, t.label);

    const candidates = [fromStream, fromLaps].filter((c): c is BestEffortResult => c !== null);
    if (candidates.length === 0) continue;

    const best = candidates.reduce((a, b) => (a.timeSec < b.timeSec ? a : b));
    results.push(best);
  }

  return results;
}
