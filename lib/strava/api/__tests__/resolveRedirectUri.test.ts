import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveRedirectUri } from "../config";

const CALLBACK = "/api/auth/strava/callback";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/auth/strava/authorize", {
    headers,
  });
}

describe("resolveRedirectUri", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.STRAVA_REDIRECT_URI;
    delete process.env.STRAVA_REDIRECT_URI;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.STRAVA_REDIRECT_URI;
    else process.env.STRAVA_REDIRECT_URI = saved;
  });

  it("uses STRAVA_REDIRECT_URI when set (explicit override wins)", () => {
    process.env.STRAVA_REDIRECT_URI = "https://pinned.example.com" + CALLBACK;
    expect(resolveRedirectUri(req({ host: "192.168.1.5:3000" }))).toBe(
      "https://pinned.example.com" + CALLBACK,
    );
  });

  it("derives from the request host (LAN access)", () => {
    expect(resolveRedirectUri(req({ host: "192.168.1.5:3000" }))).toBe(
      "http://192.168.1.5:3000" + CALLBACK,
    );
  });

  it("honors X-Forwarded-* (behind an https tunnel)", () => {
    expect(
      resolveRedirectUri(
        req({
          host: "localhost:3000",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "abc.trycloudflare.com",
        }),
      ),
    ).toBe("https://abc.trycloudflare.com" + CALLBACK);
  });

  it("falls back to the request URL when no host header", () => {
    expect(resolveRedirectUri(req())).toBe("http://localhost:3000" + CALLBACK);
  });
});
