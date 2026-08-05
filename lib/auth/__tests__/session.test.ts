import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, parseSessionToken, SESSION_COOKIE } from "../session";

/**
 * Session tokens are the only thing standing between a request and another
 * athlete's data, and this module was at 0% coverage. These exercise the signing
 * and verification directly — no mocking, it is pure crypto over env config.
 */

const SECRET = "test-session-secret-at-least-16";
const USER = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  vi.useRealTimers();
});

describe("createSessionToken / parseSessionToken", () => {
  it("round-trips a user id", () => {
    expect(parseSessionToken(createSessionToken(USER))).toBe(USER);
  });

  it("emits `userId.exp.signature`", () => {
    const parts = createSessionToken(USER).split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(USER);
    expect(Number(parts[1])).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("exposes a stable cookie name", () => {
    expect(SESSION_COOKIE).toBe("strideiq_session");
  });

  it.each([
    ["undefined", undefined],
    ["empty", ""],
    ["not a token", "garbage"],
    ["two segments", "user.123"],
    ["four segments", "user.123.sig.extra"],
  ])("rejects a malformed token (%s)", (_label, token) => {
    expect(parseSessionToken(token as string | undefined)).toBeNull();
  });

  it("rejects a tampered user id", () => {
    const [, exp, sig] = createSessionToken(USER).split(".");
    const attacker = "22222222-2222-2222-2222-222222222222";
    expect(parseSessionToken(`${attacker}.${exp}.${sig}`)).toBeNull();
  });

  it("rejects a tampered expiry", () => {
    const [user, exp, sig] = createSessionToken(USER).split(".");
    expect(parseSessionToken(`${user}.${Number(exp) + 86400}.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const [user, exp, sig] = createSessionToken(USER).split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(parseSessionToken(`${user}.${exp}.${flipped}`)).toBeNull();
  });

  it("rejects a signature of a different length without throwing", () => {
    const [user, exp] = createSessionToken(USER).split(".");
    expect(parseSessionToken(`${user}.${exp}.short`)).toBeNull();
  });

  // The signature is over `userId.exp`, so a token minted under one secret must
  // not verify under another — this is what stops a leaked staging token working.
  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(USER);
    process.env.SESSION_SECRET = "a-completely-different-secret!!";
    expect(parseSessionToken(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken(USER);
    // Default max age is 30 days.
    vi.setSystemTime(new Date("2026-02-15T00:00:00Z"));
    expect(parseSessionToken(token)).toBeNull();
  });

  it("accepts a token still inside its window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken(USER);
    vi.setSystemTime(new Date("2026-01-20T00:00:00Z"));
    expect(parseSessionToken(token)).toBe(USER);
  });

  it("refuses to operate without a usable secret", () => {
    delete process.env.SESSION_SECRET;
    expect(() => createSessionToken(USER)).toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = "tooshort";
    expect(() => createSessionToken(USER)).toThrow(/SESSION_SECRET/);
  });
});
