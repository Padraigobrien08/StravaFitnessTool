import { stravaGet } from "./client";

export interface StravaPhoto {
  id: number;
  unique_id: string;
  urls: Record<string, string>;
  source: number;
  uploaded_at: string;
  caption?: string | null;
}

export async function fetchActivityPhotos(
  accessToken: string,
  activityId: number,
): Promise<StravaPhoto[]> {
  const data = await stravaGet<StravaPhoto[]>(
    accessToken,
    `/activities/${activityId}/photos`,
    { size: 5000 },
    { allow404: true, context: `photos ${activityId}` },
  );
  return data ?? [];
}
