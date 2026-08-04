import {
  getActivitiesSyncStatus,
  listActivitiesFromDb,
  listAllActivitiesFromDb,
} from "@/lib/db/activity-list";
import {
  fetchAllAthleteActivities,
  fetchAthleteActivitiesPage,
} from "@/lib/strava/api/fetchActivity";

export async function resolveActivitiesList(
  userId: string,
  accessToken: string,
  options: {
    page?: number;
    per_page?: number;
    after?: number;
    before?: number;
  },
): Promise<unknown> {
  const sync = await getActivitiesSyncStatus(userId);
  const page = options.page ?? 1;
  const per_page = options.per_page ?? 30;

  if (sync.fresh) {
    const { activities, total } = await listActivitiesFromDb(userId, {
      page,
      per_page,
      after: options.after,
      before: options.before,
    });
    return {
      activities,
      page,
      per_page,
      total,
      source: "database",
      lastSyncAt: sync.lastSyncAt,
    };
  }

  const activities = await fetchAthleteActivitiesPage(accessToken, {
    page,
    per_page,
    after: options.after,
    before: options.before,
  });
  return {
    activities,
    page,
    per_page,
    source: "strava_api",
    lastSyncAt: sync.lastSyncAt,
    note: sync.activityCount
      ? "Database cache stale: live Strava API used"
      : "No synced activities in database",
  };
}

export async function resolveActivitiesListAll(
  userId: string,
  accessToken: string,
  options: {
    after?: number;
    before?: number;
    max_pages?: number;
  },
): Promise<unknown> {
  const sync = await getActivitiesSyncStatus(userId);
  const maxPages = options.max_pages ?? 10;

  if (sync.fresh) {
    const activities = await listAllActivitiesFromDb(userId, {
      after: options.after,
      before: options.before,
      max: maxPages * 100,
    });
    return {
      activities,
      pagesFetched: 1,
      source: "database",
      lastSyncAt: sync.lastSyncAt,
    };
  }

  return {
    ...(await fetchAllAthleteActivities(accessToken, {
      after: options.after,
      before: options.before,
      max_pages: maxPages,
    })),
    source: "strava_api",
    lastSyncAt: sync.lastSyncAt,
  };
}
