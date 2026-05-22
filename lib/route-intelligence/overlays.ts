import type { FitLap } from "@/lib/strava/fitTypes";
import type { OverlaySegment, TimelinePoint } from "./types";

const PACE_SPIKE_THRESHOLD = 0.92;
const FADE_PACE_INCREASE = 1.08;
const PAUSE_PACE = 480;

export function detectWorkoutOverlays(
  timeline: TimelinePoint[],
  laps: FitLap[],
  workoutType?: string
): OverlaySegment[] {
  const overlays: OverlaySegment[] = [];
  if (timeline.length < 4) return overlays;

  let lapStart = 0;
  for (let li = 0; li < laps.length; li++) {
    const lap = laps[li];
    const dur = lap.timeSec ?? 0;
    if (dur <= 0) continue;
    const end = lapStart + dur;
    const lapPaces = timeline
      .filter((p) => p.elapsedSec >= lapStart && p.elapsedSec <= end)
      .map((p) => p.paceSecPerKm)
      .filter((p): p is number => p != null && p > 0);
    if (lapPaces.length >= 3) {
      const mean = lapPaces.reduce((a, b) => a + b, 0) / lapPaces.length;
      const isWork = lap.avgPaceSecPerKm != null && lap.avgPaceSecPerKm < mean * 0.96;
      overlays.push({
        id: `lap-${li}`,
        kind: isWork ? "interval" : "recovery",
        startSec: lapStart,
        endSec: end,
        label: isWork ? `Work · lap ${lap.index}` : `Recovery · lap ${lap.index}`,
        intensity: isWork ? 0.85 : 0.35,
      });
    }
    lapStart = end;
  }

  const third = Math.floor(timeline.length / 3);
  const first = timeline.slice(0, third);
  const last = timeline.slice(-third);
  const avg = (pts: TimelinePoint[]) => {
    const paces = pts.map((p) => p.paceSecPerKm).filter((p): p is number => p != null);
    if (paces.length === 0) return null;
    return paces.reduce((a, b) => a + b, 0) / paces.length;
  };
  const p1 = avg(first);
  const p3 = avg(last);
  if (p1 != null && p3 != null && p3 > p1 * FADE_PACE_INCREASE) {
    const fadeStart = timeline[third * 2]?.elapsedSec ?? 0;
    overlays.push({
      id: "fade-late",
      kind: "fade",
      startSec: fadeStart,
      endSec: timeline[timeline.length - 1].elapsedSec,
      label: "Late-session fade zone",
      intensity: 0.7,
    });
  }

  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1].paceSecPerKm;
    const cur = timeline[i].paceSecPerKm;
    if (prev != null && cur != null && cur < prev * PACE_SPIKE_THRESHOLD) {
      const t0 = timeline[i - 1].elapsedSec;
      const t1 = timeline[i].elapsedSec;
      overlays.push({
        id: `spike-${i}`,
        kind: "pace_spike",
        startSec: t0,
        endSec: t1,
        label: "Pace surge",
        intensity: 0.6,
      });
    }
    if (cur != null && cur >= PAUSE_PACE) {
      overlays.push({
        id: `pause-${i}`,
        kind: "pause",
        startSec: timeline[i].elapsedSec,
        endSec: timeline[Math.min(i + 2, timeline.length - 1)].elapsedSec,
        label: "Pause / very slow",
        intensity: 0.4,
      });
    }
  }

  if (workoutType === "tempo" && overlays.length === 0 && timeline.length > 0) {
    overlays.push({
      id: "tempo-main",
      kind: "interval",
      startSec: timeline[0].elapsedSec,
      endSec: timeline[timeline.length - 1].elapsedSec,
      label: "Threshold effort",
      intensity: 0.75,
    });
  }

  return mergeOverlapping(overlays).slice(0, 24);
}

function mergeOverlapping(segs: OverlaySegment[]): OverlaySegment[] {
  return segs.sort((a, b) => a.startSec - b.startSec);
}
