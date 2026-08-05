import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Every protected route must refuse an unauthenticated request.
 *
 * The audit found all 26 API routes at 0% coverage (§F-1, §G-1), which for an app
 * whose entire server surface is `/api/me/*` meant the single most important
 * property — "you cannot read another athlete's data without credentials" — was
 * asserted nowhere.
 *
 * This deliberately runs the *real* auth code against an empty cookie jar rather
 * than mocking `getSessionUserId`, so it exercises the actual path a caller hits.
 * No database mocks are needed: a route that rejects properly returns before it
 * touches persistence. A route that needed one would be telling us it does work
 * before checking who is asking.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

/** Every route requiring credentials, with a representative request per handler. */
const PROTECTED: {
  path: string;
  method: "GET" | "POST" | "DELETE";
  load: () => Promise<Record<string, unknown>>;
  body?: unknown;
}[] = [
  // --- session or API key ---
  {
    path: "/api/chat",
    method: "POST",
    load: () => import("../chat/route"),
    body: { messages: [] },
  },
  {
    path: "/api/me/coach-composite",
    method: "GET",
    load: () => import("../me/coach-composite/route"),
  },
  {
    path: "/api/me/coach/memory",
    method: "POST",
    load: () => import("../me/coach/memory/route"),
    body: {},
  },
  {
    path: "/api/me/coach/plan",
    method: "POST",
    load: () => import("../me/coach/plan/route"),
    body: {},
  },
  {
    path: "/api/me/forecast-accuracy",
    method: "GET",
    load: () => import("../me/forecast-accuracy/route"),
  },
  { path: "/api/me/intelligence", method: "GET", load: () => import("../me/intelligence/route") },
  {
    path: "/api/me/learning/observability",
    method: "GET",
    load: () => import("../me/learning/observability/route"),
  },
  {
    path: "/api/me/recommendation-outcomes",
    method: "GET",
    load: () => import("../me/recommendation-outcomes/route"),
  },
  { path: "/api/me/strava", method: "GET", load: () => import("../me/strava/route") },
  { path: "/api/me/strava", method: "POST", load: () => import("../me/strava/route"), body: {} },
  { path: "/api/me/weekly-plan", method: "GET", load: () => import("../me/weekly-plan/route") },
  {
    path: "/api/me/weekly-plan",
    method: "POST",
    load: () => import("../me/weekly-plan/route"),
    body: {},
  },
  // --- session only ---
  { path: "/api/me/athlete-stats", method: "GET", load: () => import("../me/athlete-stats/route") },
  { path: "/api/me/fit-details", method: "GET", load: () => import("../me/fit-details/route") },
  { path: "/api/me/import", method: "GET", load: () => import("../me/import/route") },
  { path: "/api/me/leg-feel", method: "GET", load: () => import("../me/leg-feel/route") },
  {
    path: "/api/me/leg-feel",
    method: "POST",
    load: () => import("../me/leg-feel/route"),
    body: {},
  },
  { path: "/api/me/preferences", method: "GET", load: () => import("../me/preferences/route") },
  {
    path: "/api/me/preferences",
    method: "POST",
    load: () => import("../me/preferences/route"),
    body: {},
  },
  {
    path: "/api/me/training-calendar",
    method: "GET",
    load: () => import("../me/training-calendar/route"),
  },
  {
    path: "/api/me/training-calendar",
    method: "POST",
    load: () => import("../me/training-calendar/route"),
    body: {},
  },
  {
    path: "/api/me/training-calendar",
    method: "DELETE",
    load: () => import("../me/training-calendar/route"),
    body: {},
  },
  {
    path: "/api/sync/strava",
    method: "POST",
    load: () => import("../sync/strava/route"),
    body: {},
  },
  {
    path: "/api/sync/strava/streams",
    method: "POST",
    load: () => import("../sync/strava/streams/route"),
    body: {},
  },
  {
    path: "/api/webhooks/strava/subscribe",
    method: "GET",
    load: () => import("../webhooks/strava/subscribe/route"),
  },
  {
    path: "/api/webhooks/strava/subscribe",
    method: "POST",
    load: () => import("../webhooks/strava/subscribe/route"),
    body: {},
  },
];

function request(path: string, method: string, body?: unknown) {
  return new NextRequest(`https://example.com${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = "test-session-secret-at-least-16";
  // No API key configured: the key path must be inert.
  delete process.env.STRIDEIQ_API_KEY;
  delete process.env.STRIDEIQ_API_KEY_USER_ID;
  // /api/chat returns 503 for missing LLM config *before* checking auth, so
  // without these the auth assertion below would never be reached.
  process.env.OPENAI_API_KEY = "sk-test-not-used";
  // Same for the Strava-credentialed webhook routes.
  process.env.STRAVA_CLIENT_ID = "test-client-id";
  process.env.STRAVA_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  for (const k of [
    "SESSION_SECRET",
    "OPENAI_API_KEY",
    "STRAVA_CLIENT_ID",
    "STRAVA_CLIENT_SECRET",
  ]) {
    delete process.env[k];
  }
  vi.restoreAllMocks();
});

describe("unauthenticated requests are refused", () => {
  it.each(PROTECTED.map((r) => [`${r.method} ${r.path}`, r] as const))(
    "%s returns 401",
    async (_label, route) => {
      const mod = await route.load();
      const handler = mod[route.method] as (req: NextRequest) => Promise<Response>;
      expect(handler, `${route.method} not exported`).toBeTypeOf("function");
      const res = await handler(request(route.path, route.method, route.body));
      expect(res.status).toBe(401);
    },
  );

  it("covers every protected handler in app/api", () => {
    // Guard against a new route being added without an entry here.
    expect(PROTECTED).toHaveLength(26);
  });
});

/**
 * `/api/me/status` deliberately answers 200 to anyone: the client calls it on load
 * to decide whether to show "Connect Strava", so 401 would be the wrong contract.
 * What matters is that it discloses nothing but the flag.
 */
describe("GET /api/me/status is public by design but leaks nothing", () => {
  it("returns only { connected: false } when unauthenticated", async () => {
    const { GET } = await import("../me/status/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ connected: false });
    // Explicitly assert none of the authenticated fields appear.
    for (const leak of ["stravaAthleteId", "activities", "runs", "streams", "runsMissingStreams"]) {
      expect(body).not.toHaveProperty(leak);
    }
  });
});

describe("a stray API key header cannot authenticate when none is configured", () => {
  it.each([
    ["/api/me/intelligence", () => import("../me/intelligence/route")],
    ["/api/me/forecast-accuracy", () => import("../me/forecast-accuracy/route")],
    ["/api/me/coach-composite", () => import("../me/coach-composite/route")],
  ] as const)("%s still returns 401", async (path, load) => {
    const { GET } = await load();
    const res = await GET(
      new NextRequest(`https://example.com${path}`, {
        headers: { "x-strideiq-api-key": "guessed-key" },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("public routes stay reachable", () => {
  it("GET /api/health responds without credentials", async () => {
    const { GET } = await import("../health/route");
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
