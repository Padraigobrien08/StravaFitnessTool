import { stravaGet } from "./client";

export type StravaClub = Record<string, unknown>;

export async function listAthleteClubs(
  accessToken: string
): Promise<StravaClub[]> {
  const data = await stravaGet<StravaClub[]>(
    accessToken,
    "/athlete/clubs",
    undefined,
    { context: "athlete clubs" }
  );
  return data ?? [];
}
