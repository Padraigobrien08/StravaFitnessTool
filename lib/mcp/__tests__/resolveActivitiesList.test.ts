import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/activity-list", () => ({
  getActivitiesSyncStatus: vi.fn(),
  listActivitiesFromDb: vi.fn(),
  listAllActivitiesFromDb: vi.fn(),
}));

vi.mock("@/lib/strava/api/fetchActivity", () => ({
  fetchAthleteActivitiesPage: vi.fn().mockResolvedValue([{ id: 99, name: "API Run" }]),
  fetchAllAthleteActivities: vi.fn().mockResolvedValue({
    activities: [{ id: 99 }],
    pagesFetched: 1,
  }),
}));

import { getActivitiesSyncStatus, listActivitiesFromDb } from "@/lib/db/activity-list";
import { fetchAthleteActivitiesPage } from "@/lib/strava/api/fetchActivity";
import { resolveActivitiesList } from "@/lib/mcp/resolveActivitiesList";

describe("resolveActivitiesList", () => {
  beforeEach(() => {
    vi.mocked(getActivitiesSyncStatus).mockResolvedValue({
      fresh: true,
      lastSyncAt: new Date().toISOString(),
      activityCount: 10,
      source: "sync_runs",
    });
    vi.mocked(listActivitiesFromDb).mockResolvedValue({
      activities: [{ id: 1, name: "DB Run", _source: "neon" }],
      total: 1,
    });
  });

  it("uses database when sync is fresh", async () => {
    const result = (await resolveActivitiesList("u1", "token", {
      page: 1,
      per_page: 10,
    })) as { source: string; activities: { id: number }[] };

    expect(result.source).toBe("database");
    expect(result.activities[0]?.id).toBe(1);
    expect(fetchAthleteActivitiesPage).not.toHaveBeenCalled();
  });

  it("falls back to Strava API when stale", async () => {
    vi.mocked(getActivitiesSyncStatus).mockResolvedValue({
      fresh: false,
      lastSyncAt: null,
      activityCount: 0,
      source: "none",
    });

    const result = (await resolveActivitiesList("u1", "token", {})) as {
      source: string;
      activities: { id: number }[];
    };

    expect(result.source).toBe("strava_api");
    expect(result.activities[0]?.id).toBe(99);
  });
});
