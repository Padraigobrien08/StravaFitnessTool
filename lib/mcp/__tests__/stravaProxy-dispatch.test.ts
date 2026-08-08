import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Strava MCP proxy: one switch that turns an MCP tool call into a Strava API call.
 *
 * At 16% statements and 6.25% branches this was the largest genuinely unexercised
 * surface left, and it is the one an external client drives directly — every parameter
 * arrives as a string from an LLM, so the coercion in this file *is* the validation
 * layer. What follows characterizes that coercion action by action, and pins two places
 * where it lets bad input through.
 *
 * Everything below the proxy is mocked. The point is the dispatch and the parameter
 * handling, not the HTTP client, which has its own tests.
 */

vi.mock("@/lib/db/strava-connection", () => ({
  getStravaConnection: vi.fn(),
  getValidAccessToken: vi.fn(),
}));
vi.mock("@/lib/mcp/resolveActivitiesList", () => ({
  resolveActivitiesList: vi.fn().mockResolvedValue({ activities: [] }),
  resolveActivitiesListAll: vi.fn().mockResolvedValue({ activities: [] }),
}));
vi.mock("@/lib/strava/api/fetchActivity", () => ({
  fetchActivity: vi.fn().mockResolvedValue({ id: 42, name: "Morning Run" }),
}));
vi.mock("@/lib/strava/api/fetchRoutes", () => ({
  fetchRoute: vi.fn().mockResolvedValue({ id: 7 }),
  listAthleteRoutes: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/strava/api/starSegment", () => ({ starSegment: vi.fn() }));
vi.mock("@/lib/strava/api/fetchSegmentLeaderboard", () => ({
  fetchSegmentLeaderboard: vi.fn().mockResolvedValue({ entries: [] }),
}));
vi.mock("@/lib/strava/api/fetchSegmentEfforts", () => ({
  fetchSegmentEffort: vi.fn().mockResolvedValue({ id: 1 }),
  fetchSegmentEfforts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/strava/api/fetchSegments", () => ({
  fetchSegment: vi.fn().mockResolvedValue({ id: 5 }),
  fetchStarredSegments: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/strava/api/exploreSegments", () => ({
  exploreSegments: vi.fn().mockResolvedValue({ segments: [] }),
}));
vi.mock("@/lib/strava/api/exportRoute", () => ({
  exportRouteGpx: vi.fn().mockResolvedValue("<gpx/>"),
  exportRouteTcx: vi.fn().mockResolvedValue("<tcx/>"),
}));
vi.mock("@/lib/strava/api/fetchAthlete", () => ({
  fetchAthleteStats: vi.fn().mockResolvedValue({ fetched: true }),
  fetchAthleteZones: vi.fn().mockResolvedValue({ fetched: true }),
}));
vi.mock("@/lib/strava/api/fetchClubs", () => ({ listAthleteClubs: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/strava/api/fetchGear", () => ({ fetchAthleteGear: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/strava/api/fetchPhotos", () => ({
  fetchActivityPhotos: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/strava/api/fetchStreams", () => ({
  fetchActivityLaps: vi.fn().mockResolvedValue([]),
  fetchActivityStreams: vi.fn().mockResolvedValue({ time: [1, 2] }),
}));
vi.mock("@/lib/strava/api/compactStreams", () => ({
  compactActivityStreams: vi.fn().mockReturnValue({ activityId: 1, pointCount: 2 }),
  downsampleCompactStreams: vi.fn((p) => ({ ...p, downsampled: true })),
}));
vi.mock("@/lib/strava/api/streamChunks", () => ({
  chunkCompactStreams: vi.fn().mockReturnValue([{ data: { chunk: 1 } }]),
  selectStreamChunk: vi.fn().mockReturnValue({ selected: true }),
}));
vi.mock("@/lib/strava/api/verboseStreams", () => ({
  verboseActivityStreams: vi.fn().mockReturnValue({ verbose: true }),
}));
vi.mock("@/lib/strava/api/formatActivitySummary", () => ({
  formatActivitySummary: vi.fn().mockReturnValue("summary text"),
}));
vi.mock("@/lib/strava/api/formatWorkoutFile", () => ({
  activityGpxExport: vi.fn().mockReturnValue("<gpx/>"),
}));

import { getStravaConnection, getValidAccessToken } from "@/lib/db/strava-connection";
import { resolveActivitiesList } from "@/lib/mcp/resolveActivitiesList";
import { StravaApiError } from "@/lib/strava/api/client";
import { fetchRoute } from "@/lib/strava/api/fetchRoutes";
import { fetchSegmentEfforts } from "@/lib/strava/api/fetchSegmentEfforts";
import { fetchSegmentLeaderboard } from "@/lib/strava/api/fetchSegmentLeaderboard";
import { starSegment } from "@/lib/strava/api/starSegment";
import { handleStravaMcpAction } from "@/lib/mcp/stravaProxy";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStravaConnection).mockResolvedValue({
    user_id: "u1",
    strava_athlete_id: "123",
    access_token: "t",
    refresh_token: "r",
    expires_at: new Date("2030-01-01T00:00:00Z"),
    scopes: "read,activity:read_all",
    athlete_json: { id: 123 },
  });
  vi.mocked(getValidAccessToken).mockResolvedValue({
    accessToken: "token",
    athlete: { id: 123 },
  });
});

describe("connection is required before anything dispatches", () => {
  it("refuses every action when there is no connection", async () => {
    vi.mocked(getStravaConnection).mockResolvedValue(null);
    await expect(handleStravaMcpAction("u1", "clubs", {})).rejects.toThrow(/No Strava connection/);
  });

  /**
   * The connection lookup happens before the switch, so an unconnected user never
   * reaches an action handler at all. Worth pinning: it means no action can
   * accidentally become reachable without a token by being added to the switch.
   */
  it("does not call the API when the connection is missing", async () => {
    vi.mocked(getStravaConnection).mockResolvedValue(null);
    await expect(handleStravaMcpAction("u1", "route", { route_id: "7" })).rejects.toThrow();
    expect(fetchRoute).not.toHaveBeenCalled();
  });
});

describe("id parsing", () => {
  it("rejects a missing id", async () => {
    await expect(handleStravaMcpAction("u1", "laps", {})).rejects.toThrow(/id required/);
  });

  it("rejects a non-numeric id", async () => {
    await expect(handleStravaMcpAction("u1", "laps", { id: "abc" })).rejects.toThrow(/id required/);
  });

  it("names the parameter in the error, so the client knows which one to fix", async () => {
    await expect(handleStravaMcpAction("u1", "segment", {})).rejects.toThrow(/segment id required/);
  });

  /**
   * `parseInt` is lenient by design here — trailing junk is truncated rather than
   * rejected. Pinned as intentional: an LLM passing "42 (Morning Run)" gets activity 42
   * rather than an error, which is the friendlier failure for this caller.
   */
  it("truncates trailing junk rather than rejecting it", async () => {
    const result = (await handleStravaMcpAction("u1", "laps", { id: "42abc" })) as {
      activityId: number;
    };
    expect(result.activityId).toBe(42);
  });
});

describe("activities paging", () => {
  it("defaults to page 1 and 30 per page", async () => {
    await handleStravaMcpAction("u1", "activities", {});
    expect(resolveActivitiesList).toHaveBeenCalledWith(
      "u1",
      "token",
      expect.objectContaining({ page: 1, per_page: 30 }),
    );
  });

  // `limit` is the friendlier alias an LLM tends to reach for; it feeds per_page.
  it("uses limit as per_page when per_page is absent", async () => {
    await handleStravaMcpAction("u1", "activities", { limit: "5" });
    expect(resolveActivitiesList).toHaveBeenCalledWith(
      "u1",
      "token",
      expect.objectContaining({ per_page: 5 }),
    );
  });

  it("lets an explicit per_page win over limit", async () => {
    await handleStravaMcpAction("u1", "activities", { limit: "5", per_page: "50" });
    expect(resolveActivitiesList).toHaveBeenCalledWith(
      "u1",
      "token",
      expect.objectContaining({ per_page: 50 }),
    );
  });

  // Garbage falls back to the default instead of reaching the API as NaN.
  it("falls back to defaults for unparseable paging values", async () => {
    await handleStravaMcpAction("u1", "activities", { page: "abc", per_page: "xyz" });
    expect(resolveActivitiesList).toHaveBeenCalledWith(
      "u1",
      "token",
      expect.objectContaining({ page: 1, per_page: 30 }),
    );
  });

  it("omits after/before entirely when unparseable, rather than sending NaN", async () => {
    await handleStravaMcpAction("u1", "activities", { after: "nope", before: "also-nope" });
    expect(resolveActivitiesList).toHaveBeenCalledWith(
      "u1",
      "token",
      expect.objectContaining({ after: undefined, before: undefined }),
    );
  });
});

describe("cached athlete data is preferred over a network call", () => {
  const total = {
    count: 10,
    distance: 100_000,
    moving_time: 36_000,
    elapsed_time: 37_000,
    elevation_gain: 500,
    achievement_count: 2,
  };
  const storedStats = {
    recent_run_totals: total,
    ytd_run_totals: total,
    all_run_totals: total,
  };

  it("returns stored stats without fetching", async () => {
    vi.mocked(getStravaConnection).mockResolvedValue({
      user_id: "u1",
      strava_athlete_id: "123",
      access_token: "t",
      refresh_token: "r",
      expires_at: new Date("2030-01-01T00:00:00Z"),
      scopes: "read",
      athlete_json: { id: 123 },
      athlete_stats_json: storedStats,
    });
    const { fetchAthleteStats } = await import("@/lib/strava/api/fetchAthlete");
    expect(await handleStravaMcpAction("u1", "stats", {})).toBe(storedStats);
    expect(fetchAthleteStats).not.toHaveBeenCalled();
  });

  it("fetches stats when nothing is stored", async () => {
    expect(await handleStravaMcpAction("u1", "stats", {})).toEqual({ fetched: true });
  });

  /**
   * `stats` returns the payload bare while `zones` wraps it in `{ zones }`. Asymmetric,
   * but both shapes are part of the published tool contract, so this pins them rather
   * than harmonizing them.
   */
  it("wraps zones but not stats", async () => {
    expect(await handleStravaMcpAction("u1", "zones", {})).toEqual({ zones: { fetched: true } });
  });
});

describe("boolean-ish parameters", () => {
  // Three different conventions in one file, because the defaults differ: verbose is
  // opt-in, laps and starring are opt-out. Pinned so the asymmetry stays deliberate.
  it("treats verbose as opt-in", async () => {
    expect(await handleStravaMcpAction("u1", "streams", { id: "1" })).not.toMatchObject({
      verbose: true,
    });
    expect(
      await handleStravaMcpAction("u1", "streams", { id: "1", verbose: "true" }),
    ).toMatchObject({ verbose: true });
  });

  it("treats compact=false as a request for verbose", async () => {
    expect(
      await handleStravaMcpAction("u1", "streams", { id: "1", compact: "false" }),
    ).toMatchObject({ verbose: true });
  });

  it("treats any non-'false' value as true for opt-out flags", async () => {
    vi.mocked(starSegment).mockResolvedValue({ id: 5 });
    await handleStravaMcpAction("u1", "segment_star", { id: "5", starred: "0" });
    expect(starSegment).toHaveBeenCalledWith("token", 5, true);

    await handleStravaMcpAction("u1", "segment_star", { id: "5", starred: "false" });
    expect(starSegment).toHaveBeenLastCalledWith("token", 5, false);
  });
});

describe("streams", () => {
  it("reports an empty payload rather than failing when there is no stream data", async () => {
    const { compactActivityStreams } = await import("@/lib/strava/api/compactStreams");
    vi.mocked(compactActivityStreams).mockReturnValueOnce(null);
    expect(await handleStravaMcpAction("u1", "streams", { id: "9" })).toMatchObject({
      activityId: 9,
      pointCount: 0,
      message: expect.stringMatching(/no stream data/i),
    });
  });

  it("downsamples only for a positive count", async () => {
    const { downsampleCompactStreams } = await import("@/lib/strava/api/compactStreams");
    await handleStravaMcpAction("u1", "streams", { id: "1", downsample: "0" });
    expect(downsampleCompactStreams).not.toHaveBeenCalled();

    await handleStravaMcpAction("u1", "streams", { id: "1", downsample: "100" });
    expect(downsampleCompactStreams).toHaveBeenCalled();
  });

  it("unwraps a single chunk instead of returning a chunk envelope", async () => {
    expect(await handleStravaMcpAction("u1", "streams", { id: "1" })).toEqual({ chunk: 1 });
  });
});

/**
 * The two defects this file was written to pin.
 *
 * Both are the same shape: a value that should be validated locally is instead handed
 * to a layer that cannot interpret it, so the client gets a misleading answer rather
 * than a clear one.
 */
describe("input that should be rejected locally", () => {
  /**
   * `route_id` is parsed with a bare `parseInt` and no finite check, while the `id`
   * fallback beside it goes through `parseId`, which validates. So the *same* malformed
   * input is a clean local error via one parameter and a wasted round trip to
   * `/routes/NaN` via the other.
   */
  it("rejects an unparseable route_id instead of requesting /routes/NaN", async () => {
    await expect(handleStravaMcpAction("u1", "route", { route_id: "abc" })).rejects.toThrow(
      /route id required/,
    );
    expect(fetchRoute).not.toHaveBeenCalled();
  });

  it("rejects an unparseable route_id on the export actions too", async () => {
    await expect(
      handleStravaMcpAction("u1", "route_export_gpx", { route_id: "abc" }),
    ).rejects.toThrow(/route id required/);
    await expect(
      handleStravaMcpAction("u1", "route_export_tcx", { route_id: "abc" }),
    ).rejects.toThrow(/route id required/);
  });

  // Both spellings are accepted, and an empty route_id still falls through to `id`
  // rather than erroring — the truthiness the original `params.route_id ?` relied on.
  it("accepts either spelling of the route id", async () => {
    await handleStravaMcpAction("u1", "route", { route_id: "7" });
    expect(fetchRoute).toHaveBeenLastCalledWith("token", 7);

    await handleStravaMcpAction("u1", "route", { id: "8" });
    expect(fetchRoute).toHaveBeenLastCalledWith("token", 8);

    await handleStravaMcpAction("u1", "route", { route_id: "", id: "9" });
    expect(fetchRoute).toHaveBeenLastCalledWith("token", 9);
  });

  it("omits an unparseable club_id rather than sending NaN", async () => {
    await handleStravaMcpAction("u1", "segment_leaderboard", { id: "5", club_id: "abc" });
    expect(fetchSegmentLeaderboard).toHaveBeenCalledWith(
      "token",
      5,
      expect.objectContaining({ club_id: undefined }),
    );
  });

  it("falls back to the default per_page rather than sending NaN", async () => {
    await handleStravaMcpAction("u1", "segment_efforts", { id: "5", per_page: "abc" });
    expect(fetchSegmentEfforts).toHaveBeenCalledWith(
      "token",
      5,
      expect.objectContaining({ per_page: 30 }),
    );
  });
});

/**
 * The sharper defect. `segment_star` maps a Strava failure to a scope hint by testing
 * `message.includes("403")` — but the client builds its message as
 * `` `${context}: ${status}` `` and `starSegment`'s context is `star segment ${id}`.
 * So the substring matches the *segment id* as readily as the status.
 *
 * `StravaApiError` carries a typed `status`, which is the thing that was actually meant.
 */
describe("segment_star error mapping", () => {
  it("explains a real 403 as a scope problem", async () => {
    vi.mocked(starSegment).mockRejectedValue(new StravaApiError("star segment 9: 403", 403));
    await expect(handleStravaMcpAction("u1", "segment_star", { id: "9" })).rejects.toThrow(
      /check Strava app scopes/,
    );
  });

  // Segment 403 exists. A 404 on it is not a permissions problem, and telling the
  // athlete to go fix their OAuth scopes sends them somewhere with nothing to find.
  it("does not call a 404 on segment 403 a scope problem", async () => {
    vi.mocked(starSegment).mockRejectedValue(
      new StravaApiError("star segment 403: 404 Not Found", 404),
    );
    await expect(handleStravaMcpAction("u1", "segment_star", { id: "403" })).rejects.toThrow(/404/);
    await expect(handleStravaMcpAction("u1", "segment_star", { id: "403" })).rejects.not.toThrow(
      /check Strava app scopes/,
    );
  });

  // The response body is interpolated into the message too, so any error whose body
  // mentions 403 misfires the same way.
  it("does not misread 403 appearing in an error body", async () => {
    vi.mocked(starSegment).mockRejectedValue(
      new StravaApiError("star segment 9: 500 rate limit id 403x", 500),
    );
    await expect(handleStravaMcpAction("u1", "segment_star", { id: "9" })).rejects.not.toThrow(
      /check Strava app scopes/,
    );
  });

  it("passes through a non-Strava error untouched", async () => {
    vi.mocked(starSegment).mockRejectedValue(new Error("socket hang up"));
    await expect(handleStravaMcpAction("u1", "segment_star", { id: "9" })).rejects.toThrow(
      /socket hang up/,
    );
  });
});
