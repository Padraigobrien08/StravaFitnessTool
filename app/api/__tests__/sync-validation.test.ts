import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { MAX_STREAM_RUNS_PER_SYNC, DEFAULT_STREAM_RUNS_PER_SYNC } from "@/lib/sync/limits";

/**
 * Quota-spending inputs on the sync routes (§F-5).
 *
 * These routes accepted any JSON number for their run counts, because
 * `typeof x === "number"` is also true of `-1`, `0`, `NaN`, `Infinity` and `1e9`. Each
 * stream is a Strava API call against a limit shared by every athlete on the
 * deployment, so an unbounded value here is not a per-user problem — it exhausts the
 * app's quota and everyone starts getting 429s.
 *
 * The assertions check the value that reaches the sync function, not just the status
 * code: a 200 that quietly passed `Infinity` downstream would be the actual bug.
 */

const SECRET = "test-session-secret-at-least-16";
const USER = "11111111-1111-1111-1111-111111111111";

const cookieStore = { value: undefined as string | undefined };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "strideiq_session" && cookieStore.value ? { value: cookieStore.value } : undefined,
  }),
}));

const syncStravaActivitiesForUser = vi.fn();
vi.mock("@/lib/sync/stravaSync", () => ({
  syncStravaActivitiesForUser: (...a: unknown[]) => syncStravaActivitiesForUser(...a),
}));

const syncStravaStreamsForUser = vi.fn();
vi.mock("@/lib/sync/stravaStreams", () => ({
  syncStravaStreamsForUser: (...a: unknown[]) => syncStravaStreamsForUser(...a),
}));

const countRunsMissingStreams = vi.fn();
vi.mock("@/lib/db/activity-streams", () => ({
  countRunsMissingStreams: (...a: unknown[]) => countRunsMissingStreams(...a),
}));

const handleStravaMcpAction = vi.fn();
vi.mock("@/lib/mcp/stravaProxy", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  handleStravaMcpAction: (...a: unknown[]) => handleStravaMcpAction(...a),
}));

function post(path: string, body?: unknown) {
  return new NextRequest(`https://example.com${path}`, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  cookieStore.value = createSessionToken(USER);
  syncStravaActivitiesForUser.mockReset().mockResolvedValue({ synced: 0, streamsSynced: 0 });
  syncStravaStreamsForUser.mockReset().mockResolvedValue({ streamsSynced: 0, skipped: 0 });
  countRunsMissingStreams.mockReset().mockResolvedValue(0);
  handleStravaMcpAction.mockReset().mockResolvedValue({ ok: true });
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  cookieStore.value = undefined;
});

describe("POST /api/sync/strava", () => {
  async function call(body?: unknown) {
    const { POST } = await import("@/app/api/sync/strava/route");
    return POST(post("/api/sync/strava", body));
  }

  it("accepts no body and uses the default run count", async () => {
    expect((await call()).status).toBe(200);
    expect(syncStravaActivitiesForUser).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ streamMaxRuns: DEFAULT_STREAM_RUNS_PER_SYNC }),
    );
  });

  it("accepts a valid run count", async () => {
    expect((await call({ streamMaxRuns: 10 })).status).toBe(200);
    expect(syncStravaActivitiesForUser).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ streamMaxRuns: 10 }),
    );
  });

  it.each([
    ["a quota-draining value", { streamMaxRuns: 1_000_000 }],
    ["the ceiling plus one", { streamMaxRuns: MAX_STREAM_RUNS_PER_SYNC + 1 }],
    ["zero", { streamMaxRuns: 0 }],
    ["a negative count", { streamMaxRuns: -5 }],
    ["a fractional count", { streamMaxRuns: 2.5 }],
    ["Infinity, which JSON encodes as null", { streamMaxRuns: Infinity }],
    ["NaN, which JSON encodes as null", { streamMaxRuns: NaN }],
    ["a numeric string", { streamMaxRuns: "50" }],
    ["a non-boolean skipStreams", { skipStreams: "yes" }],
    ["an unknown field", { unexpected: true }],
  ])("rejects %s with 422", async (_label, body) => {
    expect((await call(body)).status).toBe(422);
    expect(syncStravaActivitiesForUser).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    cookieStore.value = undefined;
    expect((await call({ streamMaxRuns: 10 })).status).toBe(401);
    expect(syncStravaActivitiesForUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/sync/strava/streams", () => {
  async function call(body?: unknown) {
    const { POST } = await import("@/app/api/sync/strava/streams/route");
    return POST(post("/api/sync/strava/streams", body));
  }

  it("accepts no body and uses the default", async () => {
    expect((await call()).status).toBe(200);
    expect(syncStravaStreamsForUser).toHaveBeenCalledWith(USER, {
      maxRuns: DEFAULT_STREAM_RUNS_PER_SYNC,
    });
  });

  it("clamps nothing silently — an over-limit value is rejected, not reduced", async () => {
    // Silently clamping would be friendlier and worse: the caller would believe it
    // got 1e6 runs and never learn the ceiling exists.
    expect((await call({ maxRuns: 1_000_000 })).status).toBe(422);
    expect(syncStravaStreamsForUser).not.toHaveBeenCalled();
  });

  it.each([
    ["zero", { maxRuns: 0 }],
    ["a negative count", { maxRuns: -1 }],
    ["a string", { maxRuns: "40" }],
    ["null", { maxRuns: null }],
  ])("rejects %s with 422", async (_label, body) => {
    expect((await call(body)).status).toBe(422);
  });

  it("accepts exactly the ceiling", async () => {
    expect((await call({ maxRuns: MAX_STREAM_RUNS_PER_SYNC })).status).toBe(200);
  });
});

describe("POST /api/me/strava (segment_star)", () => {
  async function call(body: unknown) {
    const { POST } = await import("@/app/api/me/strava/route");
    return POST(post("/api/me/strava", body));
  }

  it("accepts a numeric id", async () => {
    expect((await call({ action: "segment_star", id: 229781 })).status).toBe(200);
    expect(handleStravaMcpAction).toHaveBeenCalledWith(
      USER,
      "segment_star",
      expect.objectContaining({ id: "229781", starred: "true" }),
    );
  });

  it("accepts a numeric string id, as MCP clients send", async () => {
    expect((await call({ action: "segment_star", segment_id: "229781" })).status).toBe(200);
  });

  it("passes starred:false through rather than defaulting it to true", async () => {
    await call({ action: "segment_star", id: 1, starred: false });
    expect(handleStravaMcpAction).toHaveBeenCalledWith(
      USER,
      "segment_star",
      expect.objectContaining({ starred: "false" }),
    );
  });

  // The old code did String(body.id ?? body.segment_id ?? ""), so each of these
  // reached the Strava proxy as a plausible-looking string.
  it.each([
    ["an object id", { action: "segment_star", id: { evil: true } }, "[object Object]"],
    ["an array id", { action: "segment_star", id: [1, 2] }, "1,2"],
    ["a missing id", { action: "segment_star" }, ""],
    ["a non-numeric string id", { action: "segment_star", id: "abc" }, "abc"],
    ["a negative id", { action: "segment_star", id: -1 }, "-1"],
  ])("rejects %s with 422 instead of forwarding %s", async (_label, body, _forwarded) => {
    expect((await call(body)).status).toBe(422);
    expect(handleStravaMcpAction).not.toHaveBeenCalled();
  });

  it("still rejects a non-star action with 400", async () => {
    expect((await call({ action: "list_activities" })).status).toBe(400);
  });
});
