import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextSyncCursor } from "../stravaSync";

/**
 * The ingestion path a connected athlete actually hits, which sat at 0% coverage.
 *
 * The defect these were written against: `last_after` had been recorded by every sync
 * run since migration 001 and read by nothing, because no caller ever passed
 * `afterEpochSec`. Incremental sync existed as a column, a parameter and a
 * computation, and did not exist as behaviour — every sync re-fetched the athlete's
 * whole history up to the 5000-activity page cap.
 */

const startSyncRun = vi.fn();
const finishSyncRun = vi.fn();
const getLastSyncCursor = vi.fn();
vi.mock("@/lib/db/sync-runs", () => ({
  startSyncRun: (...a: unknown[]) => startSyncRun(...a),
  finishSyncRun: (...a: unknown[]) => finishSyncRun(...a),
  getLastSyncCursor: (...a: unknown[]) => getLastSyncCursor(...a),
}));

const upsertActivities = vi.fn();
vi.mock("@/lib/db/activities", () => ({
  upsertActivities: (...a: unknown[]) => upsertActivities(...a),
}));

const getValidAccessToken = vi.fn();
const syncAthleteMetaForUser = vi.fn();
vi.mock("@/lib/db/strava-connection", () => ({
  getValidAccessToken: (...a: unknown[]) => getValidAccessToken(...a),
  syncAthleteMetaForUser: (...a: unknown[]) => syncAthleteMetaForUser(...a),
}));

const fetchAthleteActivities = vi.fn();
vi.mock("@/lib/strava/api/fetchActivities", () => ({
  fetchAthleteActivities: (...a: unknown[]) => fetchAthleteActivities(...a),
}));

const syncStravaStreamsForUser = vi.fn();
vi.mock("@/lib/sync/stravaStreams", () => ({
  syncStravaStreamsForUser: (...a: unknown[]) => syncStravaStreamsForUser(...a),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const USER = "athlete-1";
const DAY = 86_400;
const WEEK = 7 * DAY;

function activity(startDate: string, id = 1) {
  return { id, start_date: startDate, sport_type: "Run" };
}

/** The epoch second of an ISO date, which is what the cursor stores. */
const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

beforeEach(() => {
  startSyncRun.mockReset().mockResolvedValue("run-1");
  finishSyncRun.mockReset().mockResolvedValue(undefined);
  getLastSyncCursor.mockReset().mockResolvedValue(null);
  upsertActivities.mockReset().mockImplementation((_u, list: unknown[]) => list.length);
  getValidAccessToken.mockReset().mockResolvedValue({ accessToken: "tok" });
  syncAthleteMetaForUser.mockReset().mockResolvedValue(undefined);
  fetchAthleteActivities.mockReset().mockResolvedValue({ activities: [], truncated: false });
  syncStravaStreamsForUser.mockReset().mockResolvedValue({ streamsSynced: 0, skipped: 0 });
});

async function sync(options?: Record<string, unknown>) {
  const { syncStravaActivitiesForUser } = await import("../stravaSync");
  return syncStravaActivitiesForUser(USER, options);
}

/** The `after` value handed to Strava, or undefined for a full fetch. */
const afterArg = () => fetchAthleteActivities.mock.calls[0]?.[1];

describe("nextSyncCursor", () => {
  // The old code took activities[length - 1], which assumes an ordering the response
  // is not required to hold and which has not been verified here. The test asserts the
  // property that makes the assumption unnecessary: same answer under any order.
  it("takes the newest date regardless of array order", () => {
    const dates = ["2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z", "2026-02-01T00:00:00Z"];
    expect(nextSyncCursor(dates)).toBe(at("2026-03-01T00:00:00Z"));
    expect(nextSyncCursor([...dates].reverse())).toBe(at("2026-03-01T00:00:00Z"));
  });

  it("is null for no activities", () => {
    expect(nextSyncCursor([])).toBeNull();
  });

  it("ignores unparseable dates rather than poisoning the cursor with NaN", () => {
    expect(nextSyncCursor(["not-a-date", "2026-01-01T00:00:00Z"])).toBe(at("2026-01-01T00:00:00Z"));
  });

  it("is null when every date is unparseable", () => {
    expect(nextSyncCursor(["nope", ""])).toBeNull();
  });
});

describe("syncStravaActivitiesForUser — resuming", () => {
  it("fetches everything on a first sync", async () => {
    await sync();
    expect(afterArg()).toBeUndefined();
  });

  it("resumes from the stored cursor, minus an overlap window", async () => {
    const cursor = at("2026-03-01T00:00:00Z");
    getLastSyncCursor.mockResolvedValue(cursor);
    await sync();
    expect(afterArg()).toBe(cursor - WEEK);
  });

  // Late uploads and backdated edits arrive with a start_date earlier than the
  // high-water mark. Resuming exactly at it would skip them permanently; upsert
  // semantics make the re-scan free of side effects.
  it("re-scans far enough back to catch a backdated upload", async () => {
    const cursor = at("2026-03-10T00:00:00Z");
    getLastSyncCursor.mockResolvedValue(cursor);
    await sync();
    const backdated = at("2026-03-05T00:00:00Z"); // uploaded late, 5 days earlier
    expect(afterArg()).toBeLessThan(backdated);
  });

  it("honours an explicit afterEpochSec over the stored cursor", async () => {
    getLastSyncCursor.mockResolvedValue(at("2026-03-01T00:00:00Z"));
    await sync({ afterEpochSec: 12345 });
    expect(afterArg()).toBe(12345);
    expect(getLastSyncCursor).not.toHaveBeenCalled();
  });

  it("ignores the cursor when full is requested", async () => {
    getLastSyncCursor.mockResolvedValue(at("2026-03-01T00:00:00Z"));
    await sync({ full: true });
    expect(afterArg()).toBeUndefined();
  });

  it("never asks for a negative timestamp", async () => {
    getLastSyncCursor.mockResolvedValue(10);
    await sync();
    expect(afterArg()).toBe(0);
  });

  /**
   * The cursor is an optimisation, so a lookup failure must not fail the sync — but
   * that guarantee lives inside `getLastSyncCursor`, which swallows its own errors
   * and returns null (see `lib/db/__tests__/sync-cursor.test.ts`). Here the function
   * is mocked, so a rejection bypasses that catch and reaches the sync's own handler.
   *
   * What this pins is therefore the *outer* contract: a throw from anywhere in the
   * body is recorded as a failed run rather than leaving a row stuck at 'running'.
   */
  it("records a failed run if the cursor lookup throws past its own guard", async () => {
    getLastSyncCursor.mockRejectedValue(new Error("db down"));
    await expect(sync()).rejects.toThrow("db down");
    expect(finishSyncRun).toHaveBeenCalledWith("run-1", "failed", 0, null, "db down");
  });
});

describe("syncStravaActivitiesForUser — recording the cursor", () => {
  it("stores the newest start_date seen", async () => {
    fetchAthleteActivities.mockResolvedValue({
      activities: [activity("2026-01-01T00:00:00Z", 1), activity("2026-02-01T00:00:00Z", 2)],
      truncated: false,
    });
    await sync();
    expect(finishSyncRun).toHaveBeenCalledWith("run-1", "completed", 2, at("2026-02-01T00:00:00Z"));
  });

  // Returning nothing means "nothing new since the cursor", so the cursor must hold
  // its position. Writing null would silently reset the athlete to a full re-sync.
  it("keeps the previous position when a sync returns no activities", async () => {
    const cursor = at("2026-03-01T00:00:00Z");
    getLastSyncCursor.mockResolvedValue(cursor);
    fetchAthleteActivities.mockResolvedValue({ activities: [], truncated: false });
    await sync();
    expect(finishSyncRun).toHaveBeenCalledWith("run-1", "completed", 0, cursor - WEEK);
  });

  it("records a failure and rethrows when Strava errors", async () => {
    fetchAthleteActivities.mockRejectedValue(new Error("Strava 500"));
    await expect(sync()).rejects.toThrow("Strava 500");
    expect(finishSyncRun).toHaveBeenCalledWith("run-1", "failed", 0, null, "Strava 500");
  });
});

describe("syncStravaActivitiesForUser — streams are optional", () => {
  it("still succeeds when the stream sync throws", async () => {
    syncStravaStreamsForUser.mockRejectedValue(new Error("streams down"));
    await expect(sync()).resolves.toMatchObject({ streamsSynced: 0 });
  });

  it("skips streams entirely when asked", async () => {
    await sync({ skipStreams: true });
    expect(syncStravaStreamsForUser).not.toHaveBeenCalled();
  });

  it("passes the caller's stream limit through", async () => {
    await sync({ streamMaxRuns: 7 });
    expect(syncStravaStreamsForUser).toHaveBeenCalledWith(USER, { maxRuns: 7 });
  });

  it("still succeeds when the athlete-meta refresh throws", async () => {
    syncAthleteMetaForUser.mockRejectedValue(new Error("zones down"));
    await expect(sync()).resolves.toMatchObject({ synced: 0 });
  });
});
