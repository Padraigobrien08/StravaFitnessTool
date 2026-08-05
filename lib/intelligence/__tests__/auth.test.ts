import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
