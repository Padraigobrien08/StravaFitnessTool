import { describe, expect, it, beforeEach } from "vitest";
import {
  evaluateRecommendationOutcome,
  trackRecommendationOutcome,
  evaluatePendingOutcomes,
  clearOutcomeStore,
  confidenceToScore,
} from "../index";
import { updateBeliefsFromOutcome } from "../updateBeliefsFromOutcome";
import { emptyProfile } from "@/lib/athlete-memory/beliefUtils";
import { lowData } from "@/lib/coaching-context/__tests__/fixtures";

describe("recommendation learning", () => {
  beforeEach(() => clearOutcomeStore("test"));

  it("does not mark supported with insufficient signals", () => {
    const o = evaluateRecommendationOutcome({
      outcome: {
        recommendationId: "x",
        issuedAt: new Date().toISOString(),
        recommendation: "Rest more",
        expectedOutcome: ["freshness recovery above 60"],
        observedSignals: ["unrelated metric"],
        evaluation: "inconclusive",
        confidenceBefore: confidenceToScore("high"),
        evidence: [],
      },
      freshness: 40,
    });
    expect(o.evaluation).not.toBe("supported");
    expect(o.evaluation).toMatch(/inconclusive|contradicted|partially/);
  });

  it("strengthens evaluation when freshness recovers", () => {
    trackRecommendationOutcome("test", {
      recommendationId: "fresh",
      // Issued two days ago: an outcome can only be observed after the recommendation
      // has had time to take effect, and anything younger stays pending by design.
      issuedAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
      recommendation: "Prioritise recovery for freshness",
      expectedOutcome: ["freshness", "recovery"],
    });
    const f = lowData.analytics;
    f.fatigue.freshness = 62;
    const outcomes = evaluatePendingOutcomes("test", f, { freshness: 38 });
    const evaluated = outcomes.find((o) => o.recommendationId === "fresh");
    expect(evaluated?.evaluation).toMatch(/supported|partially/);
  });

  it("weakens beliefs when contradicted", () => {
    const profile = emptyProfile();
    profile.fatiguePatterns = [
      {
        id: "f1",
        category: "fatigue",
        statement: "Easy weeks help freshness",
        confidence: "high",
        evidence: ["a", "b"],
        counterEvidence: [],
        lastUpdated: new Date().toISOString(),
        stability: "stable",
        recommendedUse: "Use easy weeks",
      },
    ];
    const updated = updateBeliefsFromOutcome(profile, {
      recommendationId: "r1",
      issuedAt: new Date().toISOString(),
      evaluatedAt: new Date().toISOString(),
      recommendation: "Easy weeks help freshness",
      expectedOutcome: ["freshness"],
      observedSignals: ["Freshness fell", "TSB -20"],
      evaluation: "contradicted",
      confidenceBefore: 0.8,
      confidenceAfter: 0.5,
      evidence: ["Freshness fell"],
    });
    expect(updated.fatiguePatterns[0].confidence).not.toBe("high");
    expect(updated.fatiguePatterns[0].counterEvidence.length).toBeGreaterThan(0);
  });
});
