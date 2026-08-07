import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Stream sync under rate limiting.
 *
 * The defect: on a 429 the loop slept 15s and then `continue`d — which advances to
 * the *next* activity. So the rate-limited activity was never retried, never fetched,
 * and never counted as skipped: the returned totals silently failed to add up, and
 * the backoff protected the following item rather than the one that had just failed.
 *
 * The second defect was the absence of a ceiling. With the route now permitting 200
 * runs, a rate-limited athlete could hold a serverless invocation for 50 minutes and
 * be killed by the platform mid-run.
 *
 * Timers are faked because the real path sleeps 15s per wait and 300ms between
 * activities — unfaked, this suite would take most of a minute to assert nothing.
 */

const listRunIdsMissingStreams = vi.fn();
const upsertFitDetail = vi.fn();
vi.mock("@/lib/db/activity-streams", () => ({
  listRunIdsMissingStreams: (...a: unknown[]) => listRunIdsMissingStreams(...a),
  upsertFitDetail: (...a: unknown[]) => upsertFitDetail(...a),
  countStreamsForUser: vi.fn(),
}));

const getValidAccessToken = vi.fn();
vi.mock("@/lib/db/strava-connection", () => ({
  getValidAccessToken: (...a: unknown[]) => getValidAccessToken(...a),
}));

const fetchActivityStreams = vi.fn();
const fetchActivityLaps = vi.fn();
vi.mock("@/lib/strava/api/fetchStreams", () => ({
  fetchActivityStreams: (...a: unknown[]) => fetchActivityStreams(...a),
  fetchActivityLaps: (...a: unknown[]) => fetchActivityLaps(...a),
}));

const mapStravaStreamsToFitDetail = vi.fn();
vi.mock("@/lib/strava/api/mapToFitDetail", () => ({
  mapStravaStreamsToFitDetail: (...a: unknown[]) => mapStravaStreamsToFitDetail(...a),
}));

const USER = "athlete-1";
const rateLimit = () => new Error("Strava streams fetch failed: 429 Too Many Requests");

beforeEach(() => {
  vi.useFakeTimers();
  listRunIdsMissingStreams.mockReset().mockResolvedValue([1, 2, 3]);
  upsertFitDetail.mockReset().mockResolvedValue(undefined);
  getValidAccessToken.mockReset().mockResolvedValue({ accessToken: "tok" });
  fetchActivityStreams.mockReset().mockResolvedValue({ time: [1] });
  fetchActivityLaps.mockReset().mockResolvedValue([]);
  mapStravaStreamsToFitDetail.mockReset().mockReturnValue({ id: "detail" });
});

afterEach(() => vi.useRealTimers());

/** Run the sync to completion with timers advanced automatically. */
async function run(options?: { maxRuns?: number }) {
  const { syncStravaStreamsForUser } = await import("../stravaStreams");
  const promise = syncStravaStreamsForUser(USER, options);
  await vi.runAllTimersAsync();
  return promise;
}

describe("the happy path", () => {
  it("syncs every activity and counts them", async () => {
    const result = await run();
    expect(result).toMatchObject({ streamsSynced: 3, skipped: 0, rateLimited: false });
    expect(upsertFitDetail).toHaveBeenCalledTimes(3);
  });

  it("does no work and touches no token when nothing is missing", async () => {
    listRunIdsMissingStreams.mockResolvedValue([]);
    const result = await run();
    expect(result).toEqual({
      streamsSynced: 0,
      skipped: 0,
      rateLimited: false,
      notAttempted: 0,
    });
    expect(getValidAccessToken).not.toHaveBeenCalled();
  });

  it("counts an unmappable activity as skipped, not synced", async () => {
    mapStravaStreamsToFitDetail.mockReturnValueOnce(null);
    const result = await run();
    expect(result).toMatchObject({ streamsSynced: 2, skipped: 1 });
  });

  it("counts a non-rate-limit failure as skipped and keeps going", async () => {
    fetchActivityStreams.mockRejectedValueOnce(new Error("500 Server Error"));
    const result = await run();
    expect(result).toMatchObject({ streamsSynced: 2, skipped: 1 });
  });
});

describe("rate limiting", () => {
  // The heart of the bug. The old code advanced past the 429'd activity, so it was
  // fetched once, never retried, and never counted anywhere.
  it("retries the same activity after a rate-limit wait", async () => {
    fetchActivityStreams.mockRejectedValueOnce(rateLimit());
    const result = await run();

    expect(result).toMatchObject({ streamsSynced: 3, skipped: 0, rateLimited: false });
    // Activity 1 attempted twice, then 2 and 3 once each.
    expect(fetchActivityStreams.mock.calls.map((c) => c[1])).toEqual([1, 1, 2, 3]);
  });

  it("gives up after the wait budget and reports why", async () => {
    fetchActivityStreams.mockRejectedValue(rateLimit());
    const result = await run();

    expect(result.rateLimited).toBe(true);
    expect(result.streamsSynced).toBe(0);
  });

  // The counters have to stay honest: an activity the run never reached is not the
  // same as one it examined and rejected.
  it("reports untouched activities as notAttempted rather than skipped", async () => {
    fetchActivityStreams.mockRejectedValue(rateLimit());
    const result = await run();

    expect(result.skipped).toBe(0);
    expect(result.notAttempted).toBe(3);
    expect(result.streamsSynced + result.skipped + result.notAttempted).toBe(3);
  });

  it("bounds total wait time no matter how many activities are queued", async () => {
    const { MAX_RATE_LIMIT_WAITS, RATE_LIMIT_BACKOFF_MS } = await import("../stravaStreams");
    listRunIdsMissingStreams.mockResolvedValue(Array.from({ length: 200 }, (_, i) => i + 1));
    fetchActivityStreams.mockRejectedValue(rateLimit());

    const start = Date.now();
    const result = await run({ maxRuns: 200 });
    const elapsed = Date.now() - start;

    expect(result.rateLimited).toBe(true);
    // Previously this was 200 × 15s. Now it is capped by the wait budget.
    expect(elapsed).toBeLessThanOrEqual(MAX_RATE_LIMIT_WAITS * RATE_LIMIT_BACKOFF_MS);
    expect(result.notAttempted).toBe(200);
  });

  it("keeps what it managed to sync before being cut off", async () => {
    fetchActivityStreams
      .mockResolvedValueOnce({ time: [1] }) // activity 1 succeeds
      .mockRejectedValue(rateLimit()); // then rate limited forever
    const result = await run();

    expect(result.streamsSynced).toBe(1);
    expect(result.rateLimited).toBe(true);
    expect(result.notAttempted).toBe(2);
  });
});
