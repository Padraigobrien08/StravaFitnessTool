import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The OAuth callback. Unauthenticated by necessity — it is what *creates* the
 * session — so its state check is the CSRF defence for account connection, and a
 * failure anywhere in the chain must not leave a session behind.
 */

const STATE = "0123456789abcdef0123456789abcdef";
const jar = new Map<string, string>();
const deleted: string[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void deleted.push(name),
  }),
}));

const exchangeCodeForTokens = vi.fn();
vi.mock("@/lib/strava/api/oauth", () => ({
  exchangeCodeForTokens: (...a: unknown[]) => exchangeCodeForTokens(...a),
}));
const upsertStravaConnection = vi.fn();
vi.mock("@/lib/db/strava-connection", () => ({
  upsertStravaConnection: (...a: unknown[]) => upsertStravaConnection(...a),
}));
const findUserByStravaAthleteId = vi.fn();
const createUser = vi.fn();
vi.mock("@/lib/db/users", () => ({
  findUserByStravaAthleteId: (...a: unknown[]) => findUserByStravaAthleteId(...a),
  createUser: (...a: unknown[]) => createUser(...a),
}));
const setSessionCookie = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: (...a: unknown[]) => setSessionCookie(...a),
}));

const TOKENS = { athlete: { id: 105352925 }, access_token: "a", refresh_token: "r" };

function callback(query: string) {
  return new NextRequest(`https://app.example.com/api/auth/strava/callback${query}`);
}

async function run(query: string) {
  const { GET } = await import("../auth/strava/callback/route");
  const res = await GET(callback(query));
  return { res, location: res.headers.get("location") ?? "" };
}

beforeEach(() => {
  process.env.STRAVA_CLIENT_ID = "id";
  process.env.STRAVA_CLIENT_SECRET = "secret";
  jar.clear();
  deleted.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const m of [
    exchangeCodeForTokens,
    upsertStravaConnection,
    findUserByStravaAthleteId,
    createUser,
    setSessionCookie,
  ]) {
    m.mockReset();
  }
  exchangeCodeForTokens.mockResolvedValue(TOKENS);
  findUserByStravaAthleteId.mockResolvedValue("existing-user");
  createUser.mockResolvedValue("new-user");
  upsertStravaConnection.mockResolvedValue(undefined);
  setSessionCookie.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.STRAVA_CLIENT_ID;
  delete process.env.STRAVA_CLIENT_SECRET;
  vi.restoreAllMocks();
});

describe("GET /api/auth/strava/callback", () => {
  it("connects an existing athlete and starts a session", async () => {
    jar.set("strideiq_oauth_state", STATE);
    const { location } = await run(`?code=abc&state=${STATE}`);
    expect(location).toContain("/import?strava=connected");
    expect(upsertStravaConnection).toHaveBeenCalledWith("existing-user", TOKENS);
    expect(setSessionCookie).toHaveBeenCalledWith("existing-user");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("creates a user the first time an athlete connects", async () => {
    jar.set("strideiq_oauth_state", STATE);
    findUserByStravaAthleteId.mockResolvedValue(null);
    await run(`?code=abc&state=${STATE}`);
    expect(createUser).toHaveBeenCalled();
    expect(setSessionCookie).toHaveBeenCalledWith("new-user");
  });

  it("consumes the state cookie so it cannot be replayed", async () => {
    jar.set("strideiq_oauth_state", STATE);
    await run(`?code=abc&state=${STATE}`);
    expect(deleted).toContain("strideiq_oauth_state");
  });

  // The CSRF property: no session may be created unless the state echoed back by
  // Strava matches the one this server issued.
  it.each([
    ["state missing from the query", `?code=abc`],
    ["state not matching the cookie", `?code=abc&state=deadbeefdeadbeefdeadbeefdeadbeef`],
  ])("refuses when %s", async (_label, query) => {
    jar.set("strideiq_oauth_state", STATE);
    const { location } = await run(query);
    expect(location).toContain("reason=state");
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("refuses when no state cookie was ever issued", async () => {
    const { location } = await run(`?code=abc&state=${STATE}`);
    expect(location).toContain("reason=state");
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("reports a declined consent screen distinctly from a failure", async () => {
    const { location } = await run(`?error=access_denied`);
    expect(location).toContain("/import?strava=denied");
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("refuses when Strava sends no authorization code", async () => {
    jar.set("strideiq_oauth_state", STATE);
    const { location } = await run(`?state=${STATE}`);
    expect(location).toContain("reason=nocode");
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  // Each failure mode past the state check must still leave no session.
  it("no session on a failed token exchange", async () => {
    jar.set("strideiq_oauth_state", STATE);
    exchangeCodeForTokens.mockRejectedValue(new Error("bad client secret"));
    const { location } = await run(`?code=abc&state=${STATE}`);
    expect(location).toContain("reason=token");
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("no session when the token response carries no athlete", async () => {
    jar.set("strideiq_oauth_state", STATE);
    exchangeCodeForTokens.mockResolvedValue({ access_token: "a" });
    const { location } = await run(`?code=abc&state=${STATE}`);
    expect(location).toContain("reason=noathlete");
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("no session when persistence fails", async () => {
    jar.set("strideiq_oauth_state", STATE);
    upsertStravaConnection.mockRejectedValue(new Error("db down"));
    const { location } = await run(`?code=abc&state=${STATE}`);
    expect(location).toContain("reason=db");
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("does not sync activities inline — that is the Import page's job", async () => {
    jar.set("strideiq_oauth_state", STATE);
    const { location } = await run(`?code=abc&state=${STATE}`);
    // A sync here would block the callback for many seconds; the redirect is immediate.
    expect(location).toContain("strava=connected");
  });
});
