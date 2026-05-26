import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/strava-connection", () => ({
  getStravaConnection: vi.fn(),
  getValidAccessToken: vi.fn(),
}));

vi.mock("@/lib/strava/api/fetchActivity", () => ({
  fetchAthleteActivitiesPage: vi.fn().mockResolvedValue([{ id: 1 }]),
  fetchAllAthleteActivities: vi.fn().mockResolvedValue({ activities: [], pagesFetched: 0 }),
  fetchActivity: vi.fn().mockResolvedValue({ id: 42, name: "Run" }),
}));

vi.mock("@/lib/strava/api/fetchAthlete", () => ({
  fetchAthleteStats: vi.fn(),
  fetchAthleteZones: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/strava/api/fetchStreams", () => ({
  fetchActivityLaps: vi.fn().mockResolvedValue([]),
  fetchActivityStreams: vi.fn().mockResolvedValue(null),
}));

import { getStravaConnection, getValidAccessToken } from "@/lib/db/strava-connection";
import { handleStravaMcpAction } from "@/lib/mcp/stravaProxy";

describe("handleStravaMcpAction", () => {
  beforeEach(() => {
    vi.mocked(getStravaConnection).mockResolvedValue({
      user_id: "u1",
      strava_athlete_id: "123",
      access_token: "t",
      refresh_token: "r",
      expires_at: new Date(Date.now() + 3600000),
      scopes: "read",
      athlete_json: { id: 123 },
    });
    vi.mocked(getValidAccessToken).mockResolvedValue({
      accessToken: "token",
      athlete: { id: 123 },
    });
  });

  it("rejects when not connected", async () => {
    vi.mocked(getStravaConnection).mockResolvedValue(null);
    await expect(
      handleStravaMcpAction("u1", "athlete", {})
    ).rejects.toThrow(/No Strava connection/);
  });

  it("routes athlete action", async () => {
    const result = await handleStravaMcpAction("u1", "athlete", {});
    expect(result).toMatchObject({ strava_athlete_id: "123" });
  });

  it("routes laps action", async () => {
    const result = (await handleStravaMcpAction("u1", "laps", {
      id: "42",
    })) as { activityId: number };
    expect(result.activityId).toBe(42);
  });
});
