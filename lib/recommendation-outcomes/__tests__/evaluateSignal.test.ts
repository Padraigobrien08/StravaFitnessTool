import { describe, expect, it } from "vitest";
import { evaluateSignal } from "../service";
import type { LoggedRecommendation } from "../types";

function rec(kind: string, headline: string): LoggedRecommendation {
  return {
    recommendationId: `today_session:2026-07-10`,
    producer: "today_session",
    issuedAt: "2026-07-10T08:00:00.000Z",
    targetDate: "2026-07-10",
    kind,
    headline,
    distanceKmMin: null,
    distanceKmMax: null,
    adherence: "followed",
  };
}

describe("evaluateSignal", () => {
  it("supports a recovery recommendation when freshness has recovered", () => {
    const { signal } = evaluateSignal(rec("recovery", "Recovery run or rest"), {
      freshness: 62,
      tsb: 8,
      readinessScore: 70,
    });
    // Positive family — the reused evaluator returns partially_supported when
    // not every expected token is echoed by the observed signals.
    expect(["supported", "partially_supported"]).toContain(signal);
  });

  it("flags a recovery recommendation as contradicted when freshness stays suppressed", () => {
    const { signal } = evaluateSignal(rec("recovery", "Recovery run or rest"), {
      freshness: 36,
      tsb: -18,
      readinessScore: 45,
    });
    expect(signal).toBe("contradicted");
  });

  it("is inconclusive when there is too little signal", () => {
    const { signal } = evaluateSignal(rec("tempo", "Tempo / threshold"), {});
    expect(signal).toBe("inconclusive");
  });

  it("returns a human-readable note of the observed signals", () => {
    const { note } = evaluateSignal(rec("easy", "Easy aerobic"), {
      freshness: 58,
      tsb: 5,
      readinessScore: 66,
    });
    expect(note.length).toBeGreaterThan(0);
    expect(note.toLowerCase()).toMatch(/freshness|tsb|readiness/);
  });
});
