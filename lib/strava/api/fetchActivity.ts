import { stravaGet } from "./client";
import type { StravaActivity } from "./types";

/** Full Strava activity detail (extends list shape with extra fields). */
export type StravaActivityDetail = StravaActivity & Record<string, unknown>;

const MAX_ALL_PAGES = 10;

export async function fetchActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivityDetail> {
  const data = await stravaGet<StravaActivityDetail>(
    accessToken,
    `/activities/${activityId}`,
    undefined,
    { context: `activity ${activityId}` }
  );
  if (!data) throw new Error(`Activity ${activityId} not found`);
  return data;
}

export async function fetchAthleteActivitiesPage(
  accessToken: string,
  options?: {
    page?: number;
    per_page?: number;
    after?: number;
    before?: number;
  }
): Promise<StravaActivity[]> {
  const data = await stravaGet<StravaActivity[]>(
    accessToken,
    "/athlete/activities",
    {
      page: options?.page ?? 1,
      per_page: Math.min(options?.per_page ?? 30, 200),
      ...(options?.after ? { after: options.after } : {}),
      ...(options?.before ? { before: options.before } : {}),
    },
    { context: "athlete activities" }
  );
  return data ?? [];
}

export async function fetchAllAthleteActivities(
  accessToken: string,
  options?: {
    after?: number;
    before?: number;
    per_page?: number;
    max_pages?: number;
  }
): Promise<{ activities: StravaActivity[]; pagesFetched: number }> {
  const per_page = Math.min(options?.per_page ?? 100, 200);
  const max_pages = Math.min(options?.max_pages ?? MAX_ALL_PAGES, MAX_ALL_PAGES);
  const all: StravaActivity[] = [];

  for (let page = 1; page <= max_pages; page++) {
    const batch = await fetchAthleteActivitiesPage(accessToken, {
      page,
      per_page,
      after: options?.after,
      before: options?.before,
    });
    all.push(...batch);
    if (batch.length < per_page) {
      return { activities: all, pagesFetched: page };
    }
  }

  return { activities: all, pagesFetched: max_pages };
}
