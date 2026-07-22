import type { RouteBounds, RouteGeometry, TimelinePoint } from "./types";
import { haversineM } from "./interpolate";

export function computeBounds(points: { lat: number; lon: number }[]): RouteBounds {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  return { minLat, maxLat, minLon, maxLon };
}

export function buildRouteGeometry(
  activityId: string,
  timeline: TimelinePoint[],
): RouteGeometry | null {
  if (timeline.length < 2) return null;

  const coordinates: [number, number][] = timeline.map((p) => [p.lon, p.lat]);
  let totalDistanceM = 0;
  for (let i = 1; i < timeline.length; i++) {
    totalDistanceM += haversineM(
      timeline[i - 1].lat,
      timeline[i - 1].lon,
      timeline[i].lat,
      timeline[i].lon,
    );
  }

  const durationSec = timeline[timeline.length - 1].elapsedSec;

  return {
    activityId,
    coordinates,
    bounds: computeBounds(timeline),
    totalDistanceM: Math.round(totalDistanceM),
    durationSec,
  };
}

export function positionAtTime(
  timeline: TimelinePoint[],
  t: number,
): { lat: number; lon: number; index: number } | null {
  if (timeline.length === 0) return null;
  if (t <= timeline[0].elapsedSec) {
    return { lat: timeline[0].lat, lon: timeline[0].lon, index: 0 };
  }
  const last = timeline[timeline.length - 1];
  if (t >= last.elapsedSec) {
    return {
      lat: last.lat,
      lon: last.lon,
      index: timeline.length - 1,
    };
  }
  for (let i = 0; i < timeline.length - 1; i++) {
    const a = timeline[i];
    const b = timeline[i + 1];
    if (t >= a.elapsedSec && t <= b.elapsedSec) {
      const ratio = (t - a.elapsedSec) / Math.max(0.001, b.elapsedSec - a.elapsedSec);
      return {
        lat: a.lat + (b.lat - a.lat) * ratio,
        lon: a.lon + (b.lon - a.lon) * ratio,
        index: i,
      };
    }
  }
  return { lat: last.lat, lon: last.lon, index: timeline.length - 1 };
}
