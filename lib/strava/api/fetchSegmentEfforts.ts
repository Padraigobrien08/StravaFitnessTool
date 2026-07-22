import { stravaGet } from "./client";

export type StravaSegmentEffort = Record<string, unknown>;

export async function fetchSegmentEffort(
  accessToken: string,
  effortId: number,
): Promise<StravaSegmentEffort> {
  const data = await stravaGet<StravaSegmentEffort>(
    accessToken,
    `/segment_efforts/${effortId}`,
    undefined,
    { context: `segment effort ${effortId}` },
  );
  if (!data) throw new Error(`Segment effort ${effortId} not found`);
  return data;
}

export async function fetchSegmentEfforts(
  accessToken: string,
  segmentId: number,
  options?: { start_date_local?: string; end_date_local?: string; per_page?: number },
): Promise<StravaSegmentEffort[]> {
  const data = await stravaGet<StravaSegmentEffort[]>(
    accessToken,
    `/segments/${segmentId}/all_efforts`,
    {
      per_page: options?.per_page ?? 30,
      ...(options?.start_date_local ? { start_date_local: options.start_date_local } : {}),
      ...(options?.end_date_local ? { end_date_local: options.end_date_local } : {}),
    },
    { context: `segment efforts ${segmentId}` },
  );
  return data ?? [];
}
