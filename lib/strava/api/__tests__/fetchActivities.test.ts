import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAthleteActivities, MAX_ACTIVITIES, MAX_PAGES } from "../fetchActivities";

/**
 * Pagination and the page cap.
 *
 * The cap had no signal attached: an athlete with more than 5000 activities got the
 * first 5000 and silence — no error, no log, no field on the result. Their oldest
 * training simply did not exist as far as the app was concerned, which is the sort of
 * thing that shows up much later as an unexplained gap in a CTL curve.
 */

const PER_PAGE = 100;
const fetchMock = vi.fn();

function page(count: number, startId = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    start_date: "2026-01-01T00:00:00Z",
  }));
}

function respond(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

/** The URL of the nth request, parsed. */
const urlOf = (n: number) => new URL(fetchMock.mock.calls[n][0] as string);

describe("pagination", () => {
  it("stops on the first short page", async () => {
    fetchMock.mockResolvedValueOnce(respond(page(40)));
    const { activities, truncated } = await fetchAthleteActivities("tok");
    expect(activities).toHaveLength(40);
    expect(truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops on an empty page after a full one", async () => {
    fetchMock.mockResolvedValueOnce(respond(page(PER_PAGE))).mockResolvedValueOnce(respond([]));
    const { activities, truncated } = await fetchAthleteActivities("tok");
    expect(activities).toHaveLength(PER_PAGE);
    expect(truncated).toBe(false);
  });

  it("walks pages in order and accumulates", async () => {
    fetchMock
      .mockResolvedValueOnce(respond(page(PER_PAGE, 0)))
      .mockResolvedValueOnce(respond(page(PER_PAGE, 100)))
      .mockResolvedValueOnce(respond(page(5, 200)));
    const { activities } = await fetchAthleteActivities("tok");
    expect(activities).toHaveLength(205);
    expect(urlOf(0).searchParams.get("page")).toBe("1");
    expect(urlOf(2).searchParams.get("page")).toBe("3");
  });

  it("sends the after parameter only when given one", async () => {
    fetchMock.mockResolvedValue(respond(page(1)));
    await fetchAthleteActivities("tok");
    expect(urlOf(0).searchParams.has("after")).toBe(false);

    fetchMock.mockClear();
    await fetchAthleteActivities("tok", 1_700_000_000);
    expect(urlOf(0).searchParams.get("after")).toBe("1700000000");
  });

  it("sends the bearer token", async () => {
    fetchMock.mockResolvedValue(respond(page(1)));
    await fetchAthleteActivities("tok");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer tok" },
    });
  });
});

describe("the page cap", () => {
  it("reports truncated when Strava still had more to give", async () => {
    fetchMock.mockResolvedValue(respond(page(PER_PAGE)));
    const { activities, truncated } = await fetchAthleteActivities("tok");

    expect(fetchMock).toHaveBeenCalledTimes(MAX_PAGES);
    expect(activities).toHaveLength(MAX_ACTIVITIES);
    expect(truncated).toBe(true);
  });

  // Exactly 5000 activities is not truncation — the cap was reached, but the next
  // page would have been empty. Flagging it would cry wolf on a complete history.
  it("does not report truncated when the history ends exactly at the cap", async () => {
    for (let i = 0; i < MAX_PAGES - 1; i++)
      fetchMock.mockResolvedValueOnce(respond(page(PER_PAGE)));
    fetchMock.mockResolvedValueOnce(respond(page(PER_PAGE - 1)));
    const { truncated } = await fetchAthleteActivities("tok");
    expect(truncated).toBe(false);
  });
});

describe("errors", () => {
  it("throws with the status and body", async () => {
    fetchMock.mockResolvedValue(respond("Unauthorized", false, 401));
    await expect(fetchAthleteActivities("tok")).rejects.toThrow(/401/);
  });

  it("surfaces a rate limit rather than returning a partial list silently", async () => {
    fetchMock
      .mockResolvedValueOnce(respond(page(PER_PAGE)))
      .mockResolvedValueOnce(respond("Too Many Requests", false, 429));
    await expect(fetchAthleteActivities("tok")).rejects.toThrow(/429/);
  });
});
