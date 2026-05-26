import { downsample } from "@/lib/strava/downsample";
import type { StravaLap, StravaStreamSet } from "./types";

const STREAM_META: Record<string, { unit: string; description: string }> = {
  time: { unit: "s", description: "Elapsed time from activity start" },
  distance: { unit: "m", description: "Cumulative distance" },
  heartrate: { unit: "bpm", description: "Heart rate" },
  velocity_smooth: { unit: "m/s", description: "Smoothed speed" },
  cadence: { unit: "rpm", description: "Cadence (runs: spm)" },
  altitude: { unit: "m", description: "Elevation" },
  latlng: { unit: "deg", description: "[latitude, longitude] pairs" },
  watts: { unit: "W", description: "Power" },
  temp: { unit: "°C", description: "Temperature" },
  grade_smooth: { unit: "%", description: "Road grade" },
};

export interface CompactActivityStreams {
  activityId: number;
  pointCount: number;
  streams: Record<string, number[] | [number, number][]>;
  meta: Record<string, { unit: string; description: string }>;
  laps?: StravaLap[];
}

function seriesData(
  series: StravaStreamSet[string]
): number[] | [number, number][] {
  const d = series.data;
  if (d.length > 0 && Array.isArray(d[0])) {
    return d as unknown as [number, number][];
  }
  return d;
}

/** Compact stream payload for MCP / LLM (~smaller than verbose Strava objects). */
export function compactActivityStreams(
  activityId: number,
  streams: StravaStreamSet | null,
  laps?: StravaLap[]
): CompactActivityStreams | null {
  if (!streams || Object.keys(streams).length === 0) return null;

  const out: Record<string, number[] | [number, number][]> = {};
  const meta: Record<string, { unit: string; description: string }> = {};
  let pointCount = 0;

  for (const [key, series] of Object.entries(streams)) {
    if (!series?.data?.length) continue;
    out[key] = seriesData(series);
    pointCount = Math.max(pointCount, out[key].length);
    meta[key] =
      STREAM_META[key] ?? {
        unit: "unknown",
        description: `Strava stream: ${key}`,
      };
  }

  if (pointCount === 0) return null;

  return {
    activityId,
    pointCount,
    streams: out,
    meta,
    ...(laps?.length ? { laps } : {}),
  };
}

/** Downsample numeric streams (and latlng pairs) to max N points. */
export function downsampleCompactStreams(
  payload: CompactActivityStreams,
  maxPoints: number
): CompactActivityStreams {
  if (maxPoints <= 0 || payload.pointCount <= maxPoints) return payload;

  const streams: CompactActivityStreams["streams"] = {};
  for (const [key, series] of Object.entries(payload.streams)) {
    if (Array.isArray(series[0])) {
      streams[key] = downsample(series as [number, number][], maxPoints);
    } else {
      streams[key] = downsample(series as number[], maxPoints);
    }
  }

  const firstLen = Object.values(streams)[0]?.length ?? payload.pointCount;
  return {
    ...payload,
    pointCount: firstLen,
    streams,
    meta: payload.meta,
    ...(payload.laps ? { laps: payload.laps } : {}),
  };
}
