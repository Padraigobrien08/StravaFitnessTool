import { stravaPut } from "./client";
import type { StravaSegment } from "./fetchSegments";

export async function starSegment(
  accessToken: string,
  segmentId: number,
  starred: boolean
): Promise<StravaSegment> {
  return stravaPut<StravaSegment>(
    accessToken,
    `/segments/${segmentId}/starred`,
    { starred },
    `star segment ${segmentId}`
  );
}
