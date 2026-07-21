import { describe, expect, it } from "vitest";
import { stravaUrl, StravaApiError } from "../client";

describe("stravaUrl (SSRF guard)", () => {
  it("builds a Strava API URL from a leading-slash path", () => {
    expect(stravaUrl("/activities/123")).toBe(
      "https://www.strava.com/api/v3/activities/123"
    );
  });

  it("builds a Strava API URL from a bare path", () => {
    expect(stravaUrl("segments/9")).toBe(
      "https://www.strava.com/api/v3/segments/9"
    );
  });

  it("allows an absolute URL on the Strava origin", () => {
    expect(stravaUrl("https://www.strava.com/api/v3/athlete")).toBe(
      "https://www.strava.com/api/v3/athlete"
    );
  });

  it("rejects an absolute URL on any other origin (no token leak)", () => {
    expect(() => stravaUrl("https://evil.example.com/steal")).toThrow(
      StravaApiError
    );
    expect(() => stravaUrl("http://169.254.169.254/latest/meta-data")).toThrow(
      /non-Strava host/
    );
  });
});
