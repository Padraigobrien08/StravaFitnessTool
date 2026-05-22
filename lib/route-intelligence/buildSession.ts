import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { RunActivity } from "@/lib/strava/types";
import type { WorkoutType } from "@/lib/analytics/workoutType";
import { buildRouteGeometry } from "./geometry";
import { analyzeElevationSegments } from "./elevation";
import { detectWorkoutOverlays } from "./overlays";
import { buildTimelineFromStreams } from "./timeline";
import type { RouteIntelligenceSession } from "./types";

export function buildRouteIntelligenceSession(
  run: RunActivity,
  fit: FitRunDetail | null,
  workoutType?: WorkoutType
): RouteIntelligenceSession {
  const empty: RouteIntelligenceSession = {
    activityId: run.id,
    runName: run.name,
    date: run.date,
    timeline: [],
    geometry: null,
    overlays: [],
    elevationSegments: [],
    hasGps: false,
    hasElevation: false,
    hasPace: false,
    hasHr: false,
  };

  if (!fit) return empty;

  const timeline = buildTimelineFromStreams(fit);
  if (timeline.length < 2) return empty;

  const geometry = buildRouteGeometry(run.id, timeline);
  const overlays = detectWorkoutOverlays(
    timeline,
    fit.laps,
    workoutType
  );
  const elevationSegments = analyzeElevationSegments(timeline);

  return {
    activityId: run.id,
    runName: run.name,
    date: run.date,
    timeline,
    geometry,
    overlays,
    elevationSegments,
    hasGps: true,
    hasElevation: timeline.some((p) => p.elevationM != null),
    hasPace: fit.paceStream.length > 0,
    hasHr: fit.hrStream.length > 0,
  };
}
