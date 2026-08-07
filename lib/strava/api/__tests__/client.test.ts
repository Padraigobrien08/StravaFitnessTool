import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StravaApiError, stravaGet, stravaGetText, stravaPut, stravaUrl } from "../client";

/**
 * The shared Strava HTTP client — the SSRF guard, the rate-limit retry, and the
 * error shape everything upstream branches on.
 *
 * Every request here carries the athlete's bearer token, and the paths interpolate
 * activity, segment and route ids that originate in user input. A URL that escaped
 * Strava's origin would hand that token to whoever it reached, so the host assertion
 * is the security control worth the most attention in this file.
 *
 * `fetch` is stubbed throughout; nothing leaves the process.
 */

const fetchMock = vi.fn();

function ok(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => init.headers?.[k] ?? null },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** The URL string handed to fetch on the nth call. */
const calledUrl = (n = 0) => new URL(fetchMock.mock.calls[n][0] as string);

describe("stravaUrl", () => {
  it("builds against Strava's API base", () => {
    expect(stravaUrl("/activities/123")).toBe("https://www.strava.com/api/v3/activities/123");
  });

  it("tolerates a path without a leading slash", () => {
    expect(stravaUrl("activities/123")).toBe("https://www.strava.com/api/v3/activities/123");
  });

  /**
   * The interesting cases. `path` reaches here carrying ids that came from user
   * input, so these are the shapes an attacker would try to redirect the request
   * with. All of them must stay on Strava's origin — which they do, because the base
   * carries a path component and `path` can therefore only ever extend it.
   */
  it.each([
    ["a protocol-relative host", "//evil.example.com/steal"],
    ["an absolute URL", "https://evil.example.com/steal"],
    ["a userinfo separator", "/activities/1@evil.example.com/"],
    ["backslashes", "\\\\evil.example.com/steal"],
    ["an encoded traversal", "/activities/..%2F..%2F..%2Fevil"],
  ])("keeps %s on Strava's origin", (_label, path) => {
    expect(new URL(stravaUrl(path)).hostname).toBe("www.strava.com");
  });

  it("throws a typed error rather than a bare one if the host ever escapes", () => {
    // The guard is unreachable through `path` alone, so this pins the error *shape*
    // callers depend on rather than trying to defeat the constant base.
    const err = new StravaApiError("x", 0);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("StravaApiError");
    expect(err.status).toBe(0);
  });
});

describe("stravaGet", () => {
  it("sends the bearer token", async () => {
    fetchMock.mockResolvedValue(ok({ id: 1 }));
    await stravaGet("tok", "/activities/1");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("appends search params", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await stravaGet("tok", "/athlete/activities", { page: 2, per_page: 100 });
    expect(calledUrl().searchParams.get("page")).toBe("2");
    expect(calledUrl().searchParams.get("per_page")).toBe("100");
  });

  // Sending `key=` would mean something different to Strava than omitting it.
  it.each([
    ["undefined", undefined],
    ["an empty string", ""],
  ])("omits a param that is %s", async (_label, value) => {
    fetchMock.mockResolvedValue(ok([]));
    await stravaGet("tok", "/x", { after: value as never });
    expect(calledUrl().searchParams.has("after")).toBe(false);
  });

  it("returns null for a 404 when the caller allows it", async () => {
    fetchMock.mockResolvedValue(ok("missing", { status: 404 }));
    await expect(
      stravaGet("tok", "/activities/9", undefined, { allow404: true }),
    ).resolves.toBeNull();
  });

  it("throws for a 404 when the caller does not", async () => {
    fetchMock.mockResolvedValue(ok("missing", { status: 404 }));
    await expect(stravaGet("tok", "/activities/9")).rejects.toBeInstanceOf(StravaApiError);
  });

  it("carries the status on the error, which callers branch on", async () => {
    fetchMock.mockResolvedValue(ok("nope", { status: 401 }));
    await expect(stravaGet("tok", "/x")).rejects.toMatchObject({ status: 401 });
  });
});

describe("rate limiting", () => {
  it("retries once after a 429 and returns the retry's result", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(ok("slow down", { status: 429, headers: { "Retry-After": "1" } }))
      .mockResolvedValueOnce(ok({ id: 1 }));

    const promise = stravaGet("tok", "/x");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits the interval Strava asked for", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(ok("slow", { status: 429, headers: { "Retry-After": "5" } }))
      .mockResolvedValueOnce(ok({ id: 1 }));

    const promise = stravaGet("tok", "/x");
    await vi.advanceTimersByTimeAsync(4_000);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting
    await vi.advanceTimersByTimeAsync(2_000);
    await promise;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /**
   * `Retry-After` is allowed to be an HTTP-date, not just a number of seconds
   * (RFC 9110 §10.2.3). `parseInt("Wed, 21 Oct 2026 07:28:00 GMT")` is NaN, and
   * `setTimeout(fn, NaN)` fires immediately — so the client retries a rate-limited
   * request with no delay at all, which is the opposite of what the header asked for
   * and the behaviour most likely to earn a longer ban.
   */
  it("does not retry instantly when Retry-After is an HTTP-date", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        ok("slow", { status: 429, headers: { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" } }),
      )
      .mockResolvedValueOnce(ok({ id: 1 }));

    const promise = stravaGet("tok", "/x");
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    await promise;
  });

  it("gives up rather than looping when the retry is also rate limited", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(ok("slow", { status: 429, headers: { "Retry-After": "1" } }));

    const promise = stravaGet("tok", "/x").catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const err = (await promise) as StravaApiError;
    expect(err).toBeInstanceOf(StravaApiError);
    expect(err.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("stravaGetText and stravaPut", () => {
  it("returns text rather than parsing it", async () => {
    fetchMock.mockResolvedValue(ok("<gpx/>"));
    await expect(stravaGetText("tok", "/routes/1/export_gpx")).resolves.toBe("<gpx/>");
  });

  it("sends a JSON body on PUT", async () => {
    fetchMock.mockResolvedValue(ok({ starred: true }));
    await stravaPut("tok", "/segments/1/starred", { starred: true });
    const init = fetchMock.mock.calls[0][1] as { method: string; body: string };
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ starred: true });
  });

  it.each([
    ["stravaGetText", () => stravaGetText("tok", "/x")],
    ["stravaPut", () => stravaPut("tok", "/x", {})],
  ])("%s surfaces a failure as StravaApiError", async (_label, call) => {
    fetchMock.mockResolvedValue(ok("bad", { status: 500 }));
    await expect(call()).rejects.toBeInstanceOf(StravaApiError);
  });
});

describe("retryAfterSeconds", () => {
  it("reads a plain number of seconds", async () => {
    const { retryAfterSeconds } = await import("../client");
    expect(retryAfterSeconds("5")).toBe(5);
  });

  it("falls back to a sane default when the header is absent", async () => {
    const { retryAfterSeconds } = await import("../client");
    expect(retryAfterSeconds(null)).toBe(2);
  });

  // The form that used to produce NaN, and therefore no delay at all.
  it("reads an HTTP-date as the seconds until then", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T07:28:00.000Z"));
    const { retryAfterSeconds } = await import("../client");
    expect(retryAfterSeconds("Wed, 21 Oct 2026 07:28:30 GMT")).toBe(30);
  });

  it("never waits less than a second, even for a date in the past", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T08:00:00.000Z"));
    const { retryAfterSeconds } = await import("../client");
    expect(retryAfterSeconds("Wed, 21 Oct 2026 07:28:00 GMT")).toBe(1);
  });

  // A server asking us to wait an hour should not hold a serverless invocation open.
  it("caps a very long wait", async () => {
    const { retryAfterSeconds } = await import("../client");
    expect(retryAfterSeconds("3600")).toBe(60);
  });

  it.each([["nonsense"], [""], ["   "]])(
    "falls back to the default for an unusable header (%s)",
    async (header) => {
      const { retryAfterSeconds } = await import("../client");
      expect(retryAfterSeconds(header)).toBe(2);
    },
  );

  it("never returns NaN, which would mean no delay at all", async () => {
    const { retryAfterSeconds } = await import("../client");
    for (const h of [null, "", "abc", "NaN", "Infinity", "-5", "Wed, 21 Oct 2026 07:28:00 GMT"]) {
      expect(Number.isFinite(retryAfterSeconds(h))).toBe(true);
    }
  });
});
