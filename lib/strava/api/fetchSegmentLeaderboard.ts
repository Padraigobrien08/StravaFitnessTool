import { stravaGet } from "./client";

export type SegmentLeaderboard = Record<string, unknown>;

export async function fetchSegmentLeaderboard(
  accessToken: string,
  segmentId: number,
  options?: {
    gender?: "M" | "F";
    age_group?: string;
    weight_class?: string;
    following?: boolean;
    club_id?: number;
  }
): Promise<SegmentLeaderboard> {
  const data = await stravaGet<SegmentLeaderboard>(
    accessToken,
    `/segments/${segmentId}/leaderboard`,
    {
      ...(options?.gender ? { gender: options.gender } : {}),
      ...(options?.age_group ? { age_group: options.age_group } : {}),
      ...(options?.weight_class ? { weight_class: options.weight_class } : {}),
      ...(options?.following != null
        ? { following: options.following ? "true" : "false" }
        : {}),
      ...(options?.club_id != null ? { club_id: options.club_id } : {}),
    },
    { context: `segment leaderboard ${segmentId}` }
  );
  if (!data) throw new Error(`Leaderboard for segment ${segmentId} not found`);
  return data;
}
