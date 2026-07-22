import { STRAVA_API_BASE } from "./config";
import type { StravaActivity } from "./types";

const PER_PAGE = 100;
const MAX_PAGES = 50;

export async function fetchAthleteActivities(
  accessToken: string,
  afterEpochSec?: number,
): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  let page = 1;

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
    page++;
  }

  return all;
}
