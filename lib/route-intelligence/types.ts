import type { GpsPoint } from "@/lib/strava/fitTypes";

export type OverlayKind =
  "interval" | "recovery" | "fade" | "pause" | "pace_spike" | "climb" | "descent";

export interface TimelinePoint {
  elapsedSec: number;
  lat: number;
  lon: number;
  elevationM: number | null;
  paceSecPerKm: number | null;
  hr: number | null;
  cadence: number | null;
}

export interface RouteBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface RouteGeometry {
  activityId: string;
  coordinates: [number, number][];
  bounds: RouteBounds;
  totalDistanceM: number;
  durationSec: number;
}

export interface OverlaySegment {
  id: string;
  kind: OverlayKind;
  startSec: number;
  endSec: number;
  label: string;
  intensity: number;
}

export interface ElevationSegment {
  id: string;
  kind: "climb" | "descent" | "flat";
  startSec: number;
  endSec: number;
  gainM: number;
  avgGradePct: number;
  label: string;
}

export interface RouteIntelligenceSession {
  activityId: string;
  runName: string;
  date: string;
  timeline: TimelinePoint[];
  geometry: RouteGeometry | null;
  overlays: OverlaySegment[];
  elevationSegments: ElevationSegment[];
  hasGps: boolean;
  hasElevation: boolean;
  hasPace: boolean;
  hasHr: boolean;
}

export interface ReplayState {
  currentSec: number;
  playing: boolean;
  speed: number;
  durationSec: number;
}

export type { GpsPoint };
