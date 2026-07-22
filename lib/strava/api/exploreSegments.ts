import { stravaGet } from "./client";
import type { StravaSegment } from "./fetchSegments";

export interface ExploreSegmentsResult {
  segments: StravaSegment[];
}

export async function exploreSegments(
  accessToken: string,
  bounds: [number, number, number, number],
  activityType?: string,
): Promise<ExploreSegmentsResult> {
  const [south, west, north, east] = bounds;
  const data = await stravaGet<ExploreSegmentsResult>(
    accessToken,
    "/segments/explore",
    {
      bounds: `${south},${west},${north},${east}`,
      ...(activityType ? { activity_type: activityType } : {}),
    },
    { context: "explore segments" },
  );
  return data ?? { segments: [] };
}
