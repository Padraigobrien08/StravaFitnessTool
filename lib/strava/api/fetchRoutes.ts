import { stravaGet } from "./client";

export type StravaRoute = Record<string, unknown>;

export async function listAthleteRoutes(
  accessToken: string,
  athleteId: number,
  page = 1,
  perPage = 30,
): Promise<StravaRoute[]> {
  const data = await stravaGet<StravaRoute[]>(
    accessToken,
    `/athletes/${athleteId}/routes`,
    { page, per_page: perPage },
    { context: `routes for athlete ${athleteId}` },
  );
  return data ?? [];
}

export async function fetchRoute(accessToken: string, routeId: number): Promise<StravaRoute> {
  const data = await stravaGet<StravaRoute>(accessToken, `/routes/${routeId}`, undefined, {
    context: `route ${routeId}`,
  });
  if (!data) throw new Error(`Route ${routeId} not found`);
  return data;
}
