import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { FitLap } from "@/lib/strava/fitTypes";
import { interpolateAtTime } from "./interpolate";
import type { TimelinePoint } from "./types";

export function buildTimelineFromStreams(
  fit: FitRunDetail
): TimelinePoint[] {
  const gps = fit.gpsStream ?? [];
  if (gps.length === 0) return [];

  return gps.map((g) => ({
    elapsedSec: g.elapsedSec,
    lat: g.lat,
    lon: g.lon,
    elevationM: g.elevationM ?? null,
    paceSecPerKm: interpolateAtTime(
      fit.paceStream,
      g.elapsedSec,
      (p) => p.paceSecPerKm
    ),
    hr: interpolateAtTime(fit.hrStream, g.elapsedSec, (p) => p.hr),
    cadence: interpolateAtTime(fit.cadenceStream, g.elapsedSec, (p) => p.cadence),
  }));
}

export function timelineFromPaceOnly(fit: FitRunDetail): TimelinePoint[] {
  if (fit.paceStream.length < 2) return [];
  return fit.paceStream.map((p, i) => ({
    elapsedSec: p.elapsedSec,
    lat: 0,
    lon: i * 0.0001,
    elevationM: null,
    paceSecPerKm: p.paceSecPerKm,
    hr: interpolateAtTime(fit.hrStream, p.elapsedSec, (x) => x.hr),
    cadence: interpolateAtTime(fit.cadenceStream, p.elapsedSec, (x) => x.cadence),
  }));
}

export function lapBoundariesSec(laps: FitLap[]): { start: number; end: number }[] {
  let cursor = 0;
  const out: { start: number; end: number }[] = [];
  for (const lap of laps) {
    const dur = lap.timeSec ?? 0;
    if (dur <= 0) continue;
    out.push({ start: cursor, end: cursor + dur });
    cursor += dur;
  }
  return out;
}
