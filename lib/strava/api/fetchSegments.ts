import { stravaGet } from "./client";

export type StravaSegment = Record<string, unknown>;

export async function fetchSegment(
  accessToken: string,
  segmentId: number
): Promise<StravaSegment> {
  const data = await stravaGet<StravaSegment>(
    accessToken,
    `/segments/${segmentId}`,
    undefined,
    { context: `segment ${segmentId}` }
  );
  if (!data) throw new Error(`Segment ${segmentId} not found`);
  return data;
}

export async function fetchStarredSegments(
  accessToken: string
): Promise<StravaSegment[]> {
  const data = await stravaGet<StravaSegment[]>(
    accessToken,
    "/segments/starred",
    undefined,
    { context: "starred segments" }
  );
  return data ?? [];
}
