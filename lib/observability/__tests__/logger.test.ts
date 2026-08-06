import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log, logger, redact, serializeError } from "../logger";

/**
 * The redaction tests are the load-bearing ones. A logger that works but writes a
 * database password into a hosted log aggregator is worse than no logger, because the
 * credential leaks somewhere with a long retention window and no obvious owner.
 */

let out: string[];
let errOut: string[];

beforeEach(() => {
  out = [];
  errOut = [];
  vi.spyOn(console, "log").mockImplementation((l: string) => void out.push(l));
  vi.spyOn(console, "error").mockImplementation((l: string) => void errOut.push(l));
});

afterEach(() => vi.restoreAllMocks());

describe("redact", () => {
  it.each([
    "secret",
    "SESSION_SECRET",
    "apiKey",
    "api_key",
    "API-KEY",
    "password",
    "authorization",
    "Cookie",
    "refreshToken",
    "credentials",
  ])("redacts the value of %s", (key) => {
    expect(redact({ [key]: "sensitive" })).toEqual({ [key]: "[redacted]" });
  });

  it("keeps non-sensitive fields intact", () => {
    expect(redact({ userId: "u1", count: 3, ok: true })).toEqual({
      userId: "u1",
      count: 3,
      ok: true,
    });
  });

  // The password is inside the string, so key-based redaction alone would miss it.
  it("strips the password from a connection string", () => {
    const redacted = redact("postgresql://neondb_owner:hunter2@host.neon.tech/neondb") as string;
    expect(redacted).not.toContain("hunter2");
    expect(redacted).toContain("neondb_owner");
    expect(redacted).toContain("host.neon.tech");
  });

  it("reaches into nested objects and arrays", () => {
    const result = redact({ a: { b: [{ token: "t" }] } }) as { a: { b: { token: string }[] } };
    expect(result.a.b[0].token).toBe("[redacted]");
  });

  it("terminates on a self-referential object", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    expect(() => redact(cyclic)).not.toThrow();
  });
});

describe("serializeError", () => {
  it("keeps the stack", () => {
    const s = serializeError(new Error("boom"));
    expect(s.message).toBe("boom");
    expect(String(s.stack)).toContain("boom");
  });

  it("follows the cause chain", () => {
    const s = serializeError(new Error("outer", { cause: new Error("inner") }));
    expect((s.cause as { message: string }).message).toBe("inner");
  });

  it("carries the digest React attaches to server-component errors", () => {
    const err = Object.assign(new Error("rsc"), { digest: "12345" });
    expect(serializeError(err).digest).toBe("12345");
  });

  it("handles a thrown non-Error", () => {
    expect(serializeError("just a string").message).toBe("just a string");
  });
});

describe("log", () => {
  it("emits one parseable JSON line with level and time", () => {
    log("info", { event: "test.event", userId: "u1" });
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]);
    expect(parsed).toMatchObject({ level: "info", event: "test.event", userId: "u1" });
    expect(Date.parse(parsed.time)).not.toBeNaN();
  });

  // Hosted log views separate the two streams; actionable events belong in stderr.
  it("sends warn and error to stderr, info and debug to stdout", () => {
    logger.warn({ event: "w" });
    logger.error({ event: "e" });
    logger.info({ event: "i" });
    logger.debug({ event: "d" });
    expect(errOut).toHaveLength(2);
    expect(out).toHaveLength(2);
  });

  it("redacts on the way out, not just in redact()", () => {
    logger.error({ event: "boom", databaseUrl: "postgres://u:pw@h/db", apiKey: "k" });
    expect(errOut[0]).not.toContain("pw@");
    expect(errOut[0]).not.toContain('"k"');
  });
});
