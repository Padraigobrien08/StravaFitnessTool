import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Both hooks run in the server's most fragile positions — `register` before the server
 * accepts traffic, `onRequestError` inside an error path. A throw from either is worse
 * than the problem being reported, so the swallow-everything behaviour is the point of
 * these tests rather than an afterthought.
 */

let errOut: string[];
let warnOut: string[];
const ORIGINAL = { ...process.env };

beforeEach(() => {
  errOut = [];
  warnOut = [];
  vi.spyOn(console, "error").mockImplementation((l: string) => void errOut.push(String(l)));
  vi.spyOn(console, "warn").mockImplementation((l: string) => void warnOut.push(String(l)));
  vi.spyOn(console, "log").mockImplementation(() => {});
  process.env.NEXT_RUNTIME = "nodejs";
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL };
});

function clearEnv() {
  for (const k of [
    "DATABASE_URL",
    "SESSION_SECRET",
    "STRAVA_CLIENT_ID",
    "STRAVA_CLIENT_SECRET",
    "STRAVA_WEBHOOK_VERIFY_TOKEN",
    "STRAVA_WEBHOOK_CALLBACK_URL",
    "STRAVA_WEBHOOK_SIGNING_SECRET",
    "STRIDEIQ_API_KEY",
    "STRIDEIQ_API_KEY_USER_ID",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
  ]) {
    delete process.env[k];
  }
}

describe("register", () => {
  it("stays silent when nothing is configured", async () => {
    clearEnv();
    const { register } = await import("../instrumentation");
    await register();
    expect(warnOut).toHaveLength(0);
    expect(errOut).toHaveLength(0);
  });

  it("reports an incoherent configuration without printing values", async () => {
    clearEnv();
    process.env.DATABASE_URL = "postgresql://user:hunter2@host/db";
    const { register } = await import("../instrumentation");
    await register();

    const all = [...warnOut, ...errOut].join("\n");
    expect(all).toMatch(/SESSION_SECRET/);
    expect(all).not.toContain("hunter2");
  });

  it("does nothing outside the Node runtime", async () => {
    clearEnv();
    process.env.DATABASE_URL = "postgresql://localhost/db";
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("../instrumentation");
    await register();
    expect([...warnOut, ...errOut]).toHaveLength(0);
  });

  it("never throws, whatever the environment looks like", async () => {
    clearEnv();
    process.env.SESSION_SECRET = "short";
    process.env.STRIDEIQ_API_KEY = "k";
    const { register } = await import("../instrumentation");
    await expect(register()).resolves.toBeUndefined();
  });
});

describe("onRequestError", () => {
  const request = { path: "/api/me/intelligence?userId=secret-value", method: "GET", headers: {} };
  const context = {
    routerKind: "App Router" as const,
    routePath: "/api/me/intelligence",
    routeType: "route" as const,
  };

  async function fire(err: unknown) {
    const { onRequestError } = await import("../instrumentation");
    // The real signature carries fields this test does not need to fabricate.
    await (onRequestError as unknown as (e: unknown, r: unknown, c: unknown) => Promise<void>)(
      err,
      request,
      context,
    );
    return errOut.join("\n");
  }

  it("logs the error with its route and stack", async () => {
    const line = await fire(new Error("kaboom"));
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: "error", event: "request.error", method: "GET" });
    expect(parsed.error.message).toBe("kaboom");
    expect(parsed.route).toBe("/api/me/intelligence");
  });

  // The query string is user-supplied and routinely carries identifiers.
  it("drops the query string from the logged path", async () => {
    const line = await fire(new Error("kaboom"));
    expect(line).not.toContain("secret-value");
    expect(JSON.parse(line).path).toBe("/api/me/intelligence");
  });

  it("handles a thrown non-Error", async () => {
    const line = await fire("a bare string");
    expect(JSON.parse(line).error.message).toBe("a bare string");
  });

  it("does not throw when the error itself is hostile", async () => {
    const hostile = {
      get message() {
        throw new Error("nice try");
      },
    };
    await expect(fire(hostile)).resolves.toBeDefined();
  });
});
