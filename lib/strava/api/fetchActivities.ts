import { STRAVA_API_BASE } from "./config";
import type { StravaActivity } from "./types";

const PER_PAGE = 100;
export const MAX_PAGES = 50;
export const MAX_ACTIVITIES = PER_PAGE * MAX_PAGES;

export interface FetchActivitiesResult {
  activities: StravaActivity[];
  /**
   * True when the page cap was reached with a full final page — i.e. Strava had more
   * to give. Previously this returned silently, so an athlete with more than 5000
   * activities lost the remainder with no signal anywhere: not an error, not a log,
   * not a field. Incremental sync makes hitting the cap rare, but a first sync on a
   * long history still can.
   */
  truncated: boolean;
}

export async function fetchAthleteActivities(
  accessToken: string,
  afterEpochSec?: number,
): Promise<FetchActivitiesResult> {
  const all: StravaActivity[] = [];
  let page = 1;
  let truncated = false;

  while (page <= MAX_PAGES) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(PER_PAGE),
    });
    if (afterEpochSec) params.set("after", String(afterEpochSec));

    const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Strava activities fetch failed: ${res.status} ${text}`);
    }

    const batch = (await res.json()) as StravaActivity[];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PER_PAGE) break;

    // A full page on the last allowed iteration means Strava had more to give.
    if (page === MAX_PAGES) truncated = true;
    page++;
  }

  return { activities: all, truncated };
}
