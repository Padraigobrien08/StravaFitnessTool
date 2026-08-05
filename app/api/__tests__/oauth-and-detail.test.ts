import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";

/**
 * The last routes left at 0%: the OAuth entry/exit pair, logout, and the dynamic
 * per-activity stream route.
 *
 * The OAuth handlers are unauthenticated by necessity, which makes their CSRF-state
 * handling and their behaviour on a failed exchange the properties worth pinning.
 */

const SECRET = "test-session-secret-at-least-16";
const USER = "11111111-1111-1111-1111-111111111111";

const jar = new Map<string, string>();
const deleted: string[] = [];
const sessionCookie = { value: undefined as string | undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "strideiq_session" && sessionCookie.value) return { value: sessionCookie.value };
      return jar.has(name) ? { value: jar.get(name) } : undefined;
    },
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void deleted.push(name),
  }),
}));

const getFitDetailForUser = vi.fn();
vi.mock("@/lib/db/activity-streams", () => ({
  getFitDetailForUser: (...a: unknown[]) => getFitDetailForUser(...a),
}));
const loadOrFetchFitDetailForRun = vi.fn();
vi.mock("@/lib/strava/api/fetchRunDetail", () => ({
  loadOrFetchFitDetailForRun: (...a: unknown[]) => loadOrFetchFitDetailForRun(...a),
}));

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  process.env.STRAVA_CLIENT_ID = "test-client-id";
  process.env.STRAVA_CLIENT_SECRET = "test-client-secret";
  jar.clear();
  deleted.length = 0;
  sessionCookie.value = undefined;
  getFitDetailForUser.mockReset().mockResolvedValue(null);
  loadOrFetchFitDetailForRun.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  for (const k of [
    "SESSION_SECRET",
    "STRAVA_CLIENT_ID",
    "STRAVA_CLIENT_SECRET",
    "STRAVA_REDIRECT_URI",
  ]) {
    delete process.env[k];
  }
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const { POST } = await import("../auth/logout/route");
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleted).toContain("strideiq_session");
  });
});

describe("GET /api/auth/strava/authorize", () => {
  it("redirects to Strava with the configured client and scopes", async () => {
    const { GET } = await import("../auth/strava/authorize/route");
    const res = await GET(new NextRequest("https://app.example.com/api/auth/strava/authorize"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://www.strava.com/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("scope")).toContain("activity:read_all");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/auth/strava/callback",
    );
  });

  // The state parameter is the CSRF defence for the OAuth handshake: it has to be
  // unpredictable and it has to be stored for the callback to compare against.
  it("issues an unguessable state and persists it for the callback", async () => {
    const { GET } = await import("../auth/strava/authorize/route");
    const first = await GET(new NextRequest("https://app.example.com/api/auth/strava/authorize"));
    const stateA = new URL(first.headers.get("location")!).searchParams.get("state")!;
    expect(stateA).toMatch(/^[0-9a-f]{32}$/);
    expect(jar.get("strideiq_oauth_state")).toBe(stateA);

    jar.clear();
    const second = await GET(new NextRequest("https://app.example.com/api/auth/strava/authorize"));
    const stateB = new URL(second.headers.get("location")!).searchParams.get("state")!;
    expect(stateB).not.toBe(stateA);
  });

  it("honours an explicitly pinned redirect URI", async () => {
    process.env.STRAVA_REDIRECT_URI = "https://pinned.example.com/api/auth/strava/callback";
    const { GET } = await import("../auth/strava/authorize/route");
    const res = await GET(new NextRequest("https://app.example.com/api/auth/strava/authorize"));
    expect(new URL(res.headers.get("location")!).searchParams.get("redirect_uri")).toBe(
      "https://pinned.example.com/api/auth/strava/callback",
    );
  });
});

describe("GET /api/me/fit-details/[activityId]", () => {
  const ctx = (activityId: string) => ({ params: Promise.resolve({ activityId }) });

  it("rejects an unauthenticated request", async () => {
    const { GET } = await import("../me/fit-details/[activityId]/route");
    const res = await GET(new Request("https://example.com/api/me/fit-details/123"), ctx("123"));
    expect(res.status).toBe(401);
    expect(getFitDetailForUser).not.toHaveBeenCalled();
  });

  describe("authenticated", () => {
    beforeEach(() => {
      sessionCookie.value = createSessionToken(USER);
    });

    it("scopes the lookup to the session user", async () => {
      getFitDetailForUser.mockResolvedValue({ activityId: "123", gpsStream: [[0, 0]] });
      const { GET } = await import("../me/fit-details/[activityId]/route");
      const res = await GET(new Request("https://example.com/api/me/fit-details/123"), ctx("123"));
      expect(res.status).toBe(200);
      expect(getFitDetailForUser).toHaveBeenCalledWith(USER, "123");
    });

    it("returns 404 when the activity has no stream or lap data", async () => {
      const { GET } = await import("../me/fit-details/[activityId]/route");
      const res = await GET(new Request("https://example.com/api/me/fit-details/999"), ctx("999"));
      expect(res.status).toBe(404);
    });

    it("forces a refresh when asked", async () => {
      loadOrFetchFitDetailForRun.mockResolvedValue({ activityId: "123" });
      const { GET } = await import("../me/fit-details/[activityId]/route");
      await GET(new Request("https://example.com/api/me/fit-details/123?refresh=true"), ctx("123"));
      expect(loadOrFetchFitDetailForRun).toHaveBeenCalledWith(USER, "123", { forceRefresh: true });
    });

    it("surfaces a fetch failure as 500 rather than throwing", async () => {
      getFitDetailForUser.mockRejectedValue(new Error("stream store unavailable"));
      const { GET } = await import("../me/fit-details/[activityId]/route");
      const res = await GET(new Request("https://example.com/api/me/fit-details/123"), ctx("123"));
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({ error: "stream store unavailable" });
    });
  });
});
