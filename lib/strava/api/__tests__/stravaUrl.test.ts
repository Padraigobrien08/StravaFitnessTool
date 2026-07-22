import { describe, expect, it } from "vitest";
import { stravaUrl } from "../client";

describe("stravaUrl (SSRF guard)", () => {
  it("builds a Strava API URL from a leading-slash path", () => {
    expect(stravaUrl("/activities/123")).toBe("https://www.strava.com/api/v3/activities/123");
  });

  it("builds a Strava API URL from a bare path", () => {
    expect(stravaUrl("segments/9")).toBe("https://www.strava.com/api/v3/segments/9");
  });

  // The request must never leave the Strava host, whatever the path contains —
  // paths are always appended to the constant base, so adversarial input can
  // only alter the path/query, never the host (no bearer-token leak).
  it("keeps the host on www.strava.com for adversarial paths", () => {
    for (const path of [
      "/activities/1",
      "//evil.example.com/steal",
      "https://evil.example.com/steal",
      "@169.254.169.254/latest/meta-data",
      "/../../@evil.example.com",
    ]) {
      expect(new URL(stravaUrl(path)).hostname).toBe("www.strava.com");
    }
  });
});
