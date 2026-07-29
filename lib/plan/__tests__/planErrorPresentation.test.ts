import { describe, it, expect } from "vitest";
import { planErrorPresentation } from "@/lib/plan/planErrorPresentation";

describe("planErrorPresentation", () => {
  it("returns null when there is no error", () => {
    expect(planErrorPresentation(null)).toBeNull();
    expect(planErrorPresentation("")).toBeNull();
  });

  it("never surfaces a bare HTTP reason as the headline", () => {
    const p = planErrorPresentation("Unauthorized", 401);
    expect(p?.title).not.toMatch(/unauthorized/i);
    expect(p?.title.length).toBeGreaterThan(10);
  });

  // The server's auth guard runs before the deterministic fallback, so on a 401
  // there is no local week to build. Offering the fallback button there would
  // promise a recovery the app cannot perform.
  it("does not offer the fallback on 401, and points somewhere that helps", () => {
    const p = planErrorPresentation("Unauthorized", 401);
    expect(p?.detail).toMatch(/connect strava|import/i);
    expect(p?.fallbackLabel).toBeNull();
    expect(p?.canRetry).toBe(false);
    expect(p?.link).toEqual({ label: "Connect or import data", href: "/import" });
    expect(p?.raw).toBe("Unauthorized");
  });

  it("maps 401 from the message alone when no status is available", () => {
    const p = planErrorPresentation("unauthorized");
    expect(p?.fallbackLabel).toBeNull();
    expect(p?.link?.href).toBe("/import");
  });

  it("still offers the fallback when the failure is server-side", () => {
    expect(planErrorPresentation("boom", 500)?.fallbackLabel).toBe("Build a safe week instead");
    expect(planErrorPresentation("Rate limit exceeded", 429)?.fallbackLabel).toBe(
      "Build a safe week instead",
    );
  });

  it("tells the user their saved week survived a generic failure", () => {
    const p = planErrorPresentation("boom", 500);
    expect(p?.detail).toMatch(/unchanged/i);
    expect(p?.detail).toContain("boom"); // raw reason kept, just not as the headline
  });

  it("handles rate limiting and bad input distinctly", () => {
    expect(planErrorPresentation("Rate limit exceeded", 429)?.title).toMatch(/rate limited/i);
    expect(planErrorPresentation("Invalid body", 400)?.title).toMatch(/couldn't be read/i);
  });

  it("writes copy free of banned em dashes", () => {
    for (const status of [401, 400, 429, 500]) {
      const p = planErrorPresentation("some reason", status);
      expect(`${p?.title} ${p?.detail} ${p?.fallbackLabel ?? ""}`).not.toContain("—");
    }
  });
});
