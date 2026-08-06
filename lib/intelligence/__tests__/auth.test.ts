import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";

/**
 * The dual auth path: session cookie or `STRIDEIQ_API_KEY`.
 *
 * §F-2 of the audit concluded by inspection that the API-key path cannot escalate
 * across users. These assert it, since "the user id comes from the environment,
 * never from the request" is a security invariant and inspection is not a test.
 */

const cookieStore = { value: undefined as string | undefined };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "strideiq_session" && cookieStore.value ? { value: cookieStore.value } : undefined,
  }),
}));

const getLegFeel = vi.fn();
vi.mock("@/lib/db/leg-feel", () => ({ getLegFeel: (...a: unknown[]) => getLegFeel(...a) }));

const SECRET = "test-session-secret-at-least-16";
const KEY = "test-api-key";
const KEY_USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COOKIE_USER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ATTACKER = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://example.com${url}`, { headers });
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  cookieStore.value = undefined;
  getLegFeel.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  for (const k of ["SESSION_SECRET", "STRIDEIQ_API_KEY", "STRIDEIQ_API_KEY_USER_ID"]) {
    delete process.env[k];
  }
});

async function ctx(...args: Parameters<typeof req>) {
  const { intelligenceContextFromRequest } = await import("../auth");
  return intelligenceContextFromRequest(req(...args));
}

describe("secretsMatch", () => {
  async function match(a: string, b: string) {
    const { secretsMatch } = await import("../auth");
    return secretsMatch(a, b);
  }

  it("accepts an exact match", async () => {
    await expect(match("s3cret-value", "s3cret-value")).resolves.toBe(true);
  });

  it.each([
    ["a differing last byte", "s3cret-valuE", "s3cret-value"],
    ["a differing first byte", "S3cret-value", "s3cret-value"],
    ["a truncated prefix", "s3cret", "s3cret-value"],
    ["a superstring", "s3cret-value-extra", "s3cret-value"],
    ["an empty candidate", "", "s3cret-value"],
  ])("rejects %s", async (_label, provided, expected) => {
    await expect(match(provided, expected)).resolves.toBe(false);
  });

  // timingSafeEqual throws on differing buffer lengths rather than returning false,
  // so the length guard has to come first or a short key raises a 500 instead of 401.
  it("does not throw on a length mismatch", async () => {
    await expect(match("x", "much-longer-secret")).resolves.toBe(false);
  });

  // Buffer.from(str) is UTF-8, so byte length and character length diverge here;
  // comparing lengths in characters would let these two look equal.
  it("compares bytes, not characters", async () => {
    await expect(match("é", "e")).resolves.toBe(false);
  });

  /**
   * The limit of the tests above, stated rather than glossed over.
   *
   * `===` and `timingSafeEqual` return *identical values* for every input — the
   * vulnerability is in how long the answer takes, not what it is. Every assertion in
   * this describe block passes against the vulnerable `===` implementation; they were
   * run against it to confirm that. So they pin the comparison's correctness and are
   * worth keeping, but they cannot catch a regression to `===`.
   *
   * A timing measurement would be the direct test and would be hopelessly flaky in
   * CI. Reading the source is the reliable check available, so that is what this does.
   */
  it("is implemented with timingSafeEqual, not ===", () => {
    const src = readFileSync("lib/intelligence/auth.ts", "utf8");
    const body = src.slice(src.indexOf("export function secretsMatch"));
    const fn = body.slice(0, body.indexOf("\n}"));
    expect(fn).toMatch(/timingSafeEqual\(/);
    expect(fn, "secretsMatch must not fall back to a short-circuiting compare").not.toMatch(
      /provided\s*===\s*expected/,
    );
  });

  it("no caller compares the API key directly", () => {
    const src = readFileSync("lib/intelligence/auth.ts", "utf8");
    expect(src).not.toMatch(/apiKey\s*===/);
    expect(src).not.toMatch(/===\s*process\.env\.STRIDEIQ_API_KEY/);
  });
});

describe("intelligenceContextFromRequest", () => {
  it("returns null with no credentials at all", async () => {
    await expect(ctx("/api/me/intelligence")).resolves.toBeNull();
  });

  it("authenticates a valid session cookie", async () => {
    cookieStore.value = createSessionToken(COOKIE_USER);
    expect((await ctx("/api/me/intelligence"))?.userId).toBe(COOKIE_USER);
  });

  it("rejects a forged session cookie", async () => {
    cookieStore.value = `${ATTACKER}.99999999999.not-a-real-signature`;
    await expect(ctx("/api/me/intelligence")).resolves.toBeNull();
  });

  describe("API key path", () => {
    beforeEach(() => {
      process.env.STRIDEIQ_API_KEY = KEY;
      process.env.STRIDEIQ_API_KEY_USER_ID = KEY_USER;
    });

    it("authenticates as the configured user", async () => {
      const c = await ctx("/api/me/intelligence", { "x-strideiq-api-key": KEY });
      expect(c?.userId).toBe(KEY_USER);
    });

    it("rejects a wrong key", async () => {
      await expect(
        ctx("/api/me/intelligence", { "x-strideiq-api-key": "wrong" }),
      ).resolves.toBeNull();
    });

    // §F-3: the comparison used `===`, which returns on the first differing byte and
    // so leaks the key one character at a time to anyone who can time the response.
    // A same-length near-miss is the case a prefix-guessing attacker actually sends.
    it("rejects a key matching every byte but the last", async () => {
      const nearMiss = KEY.slice(0, -1) + "!";
      expect(nearMiss).toHaveLength(KEY.length);
      await expect(
        ctx("/api/me/intelligence", { "x-strideiq-api-key": nearMiss }),
      ).resolves.toBeNull();
    });

    it("rejects a correct prefix that is too short", async () => {
      await expect(
        ctx("/api/me/intelligence", { "x-strideiq-api-key": KEY.slice(0, 4) }),
      ).resolves.toBeNull();
    });

    it("rejects the correct key with anything appended", async () => {
      await expect(
        ctx("/api/me/intelligence", { "x-strideiq-api-key": KEY + "x" }),
      ).resolves.toBeNull();
    });

    // The invariant: the user id is read from the server environment, so there is
    // no request-controlled input that can point a valid key at another athlete.
    it.each([
      ["userId query param", `/api/me/intelligence?userId=${ATTACKER}`, {}],
      ["user query param", `/api/me/intelligence?user=${ATTACKER}`, {}],
      ["athleteId query param", `/api/me/intelligence?athleteId=${ATTACKER}`, {}],
      ["x-user-id header", "/api/me/intelligence", { "x-user-id": ATTACKER }],
      ["x-strideiq-user-id header", "/api/me/intelligence", { "x-strideiq-user-id": ATTACKER }],
    ])("cannot be redirected to another user via %s", async (_label, url, headers) => {
      const c = await ctx(url, { "x-strideiq-api-key": KEY, ...headers });
      expect(c?.userId).toBe(KEY_USER);
      expect(c?.userId).not.toBe(ATTACKER);
    });

    it("is inert when no key user is configured", async () => {
      delete process.env.STRIDEIQ_API_KEY_USER_ID;
      await expect(ctx("/api/me/intelligence", { "x-strideiq-api-key": KEY })).resolves.toBeNull();
    });

    it("is inert when no key is configured, even if a header is sent", async () => {
      delete process.env.STRIDEIQ_API_KEY;
      await expect(
        ctx("/api/me/intelligence", { "x-strideiq-api-key": "anything" }),
      ).resolves.toBeNull();
    });

    // Ordering matters: a signed-in browser session must win, so an injected key
    // header cannot switch the request to the automation user mid-session.
    it("does not override an authenticated session", async () => {
      cookieStore.value = createSessionToken(COOKIE_USER);
      const c = await ctx("/api/me/intelligence", { "x-strideiq-api-key": KEY });
      expect(c?.userId).toBe(COOKIE_USER);
    });
  });

  describe("raw cookie-header fallback", () => {
    it("accepts a validly signed token from the Cookie header", async () => {
      const token = createSessionToken(COOKIE_USER);
      const c = await ctx("/api/me/intelligence", { cookie: `strideiq_session=${token}` });
      expect(c?.userId).toBe(COOKIE_USER);
    });

    // The fallback re-parses the header itself, so it must still verify the HMAC
    // rather than trusting the cookie's contents.
    it("still verifies the signature", async () => {
      const c = await ctx("/api/me/intelligence", {
        cookie: `strideiq_session=${ATTACKER}.99999999999.forged`,
      });
      expect(c).toBeNull();
    });
  });

  describe("request-scoped settings", () => {
    beforeEach(() => {
      cookieStore.value = createSessionToken(COOKIE_USER);
    });

    it("parses a race goal from the query", async () => {
      const c = await ctx(
        "/api/me/intelligence?distance=hm&raceDate=2026-10-01&targetTimeSec=5400",
      );
      expect(c?.raceGoal).toMatchObject({
        distance: "hm",
        date: "2026-10-01",
        targetTimeSec: 5400,
      });
    });

    it("leaves the goal undefined when distance or date is missing", async () => {
      expect((await ctx("/api/me/intelligence?distance=hm"))?.raceGoal).toBeUndefined();
    });

    it("ignores non-positive or unparseable numeric settings", async () => {
      const c = await ctx("/api/me/intelligence?defaultWeeklyRuns=-3&maxWeeklyKm=abc");
      expect(c?.settings?.defaultWeeklyRuns).toBeUndefined();
      expect(c?.settings?.maxWeeklyKm).toBeUndefined();
    });

    it("accepts valid numeric settings", async () => {
      const c = await ctx("/api/me/intelligence?defaultWeeklyRuns=5&maxWeeklyKm=60.5");
      expect(c?.settings).toMatchObject({ defaultWeeklyRuns: 5, maxWeeklyKm: 60.5 });
    });

    it("surfaces today's leg feel and survives a database failure", async () => {
      getLegFeel.mockResolvedValue({ legs: "heavy" });
      expect((await ctx("/api/me/intelligence"))?.legFeel).toBe("heavy");
      getLegFeel.mockResolvedValue(null);
      expect((await ctx("/api/me/intelligence"))?.legFeel).toBeUndefined();
    });
  });
});
