import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoImport, demoRaceGoal } from "@/lib/demo/generateDemoData";
import { computeInsights } from "@/lib/analytics";
import { buildAthleteMemoryProfile } from "@/lib/athlete-memory";
import type { AthleteMemoryProfile } from "@/lib/athlete-memory/types";
import {
  applyOutcomesToMemory,
  clearOutcomeStore,
  evaluatePendingOutcomes,
  getTrackedOutcomes,
  hydrateOutcomeStore,
  trackRecommendationOutcome,
} from "../index";

/**
 * Crossing the request boundary.
 *
 * The observation window added in #118 made the loop correct, and simultaneously made
 * it inert: an outcome must wait a day to be judged, but the store was a per-process
 * Map, so the pending record never survived to the request that could judge it.
 *
 * `hydrateOutcomeStore` is the seam that fixes it. These tests simulate the boundary
 * the way production actually crosses it — `clearOutcomeStore()` is what a cold start
 * does — and assert the loop closes *through* it. No database is needed: the store
 * contract is what matters here, and `lib/db/__tests__/recommendation-outcome-log.test.ts`
 * covers the SQL round-trip.
 */

const NOW = new Date("2026-08-05T09:00:00.000Z");
const analytics = computeInsights(buildDemoImport(NOW), [], 4, demoRaceGoal(NOW));
const USER = "athlete-1";
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function beliefCount(p: AthleteMemoryProfile): number {
  return (
    p.adaptationPatterns.length +
    p.fatiguePatterns.length +
    p.pacingPatterns.length +
    p.taperResponses.length +
    p.modalityInteractions.length +
    p.durabilitySignals.length
  );
}

beforeEach(() => clearOutcomeStore());

describe("the loop closes across a request boundary", () => {
  it("a recommendation issued yesterday is judged today, in a fresh process", () => {
    // --- request 1, yesterday: track, too soon to judge, persist ---
    trackRecommendationOutcome(USER, {
      recommendationId: "primary-2026-08-04",
      issuedAt: hoursAgo(25),
      recommendation: "Keep intensity easy and protect freshness",
      expectedOutcome: ["freshness", "readiness"],
    });
    const persisted = getTrackedOutcomes(USER);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].evaluatedAt).toBeFalsy();

    // --- cold start: the working set is gone ---
    clearOutcomeStore();
    expect(getTrackedOutcomes(USER)).toHaveLength(0);

    // --- request 2, today: hydrate, and now it can be judged ---
    hydrateOutcomeStore(USER, persisted);
    const outcomes = evaluatePendingOutcomes(USER, analytics, undefined, NOW);
    expect(outcomes[0].evaluatedAt).toBeTruthy();

    const before = buildAthleteMemoryProfile(analytics, USER);
    const after = applyOutcomesToMemory(before, outcomes);
    expect(beliefCount(after)).toBeGreaterThan(beliefCount(before));
  });

  it("without hydration the same outcome is simply lost", () => {
    trackRecommendationOutcome(USER, {
      recommendationId: "primary-2026-08-04",
      issuedAt: hoursAgo(25),
      recommendation: "Keep intensity easy and protect freshness",
      expectedOutcome: ["freshness"],
    });
    clearOutcomeStore();
    // No hydrate: this is the pre-fix behaviour, kept as the contrast.
    const outcomes = evaluatePendingOutcomes(USER, analytics, undefined, NOW);
    expect(outcomes).toHaveLength(0);
  });
});

describe("hydrateOutcomeStore", () => {
  it("does not clobber a fresher in-flight record with an older stored one", () => {
    trackRecommendationOutcome(USER, {
      recommendationId: "rec",
      issuedAt: hoursAgo(1),
      recommendation: "in-flight version",
      expectedOutcome: [],
    });
    hydrateOutcomeStore(USER, [
      {
        recommendationId: "rec",
        issuedAt: hoursAgo(48),
        recommendation: "stored version",
        expectedOutcome: [],
        observedSignals: [],
        evaluation: "inconclusive",
        confidenceBefore: 0.5,
        evidence: [],
      },
    ]);
    expect(getTrackedOutcomes(USER)).toHaveLength(1);
    expect(getTrackedOutcomes(USER)[0].recommendation).toBe("in-flight version");
  });

  it("merges stored and in-flight records by id", () => {
    trackRecommendationOutcome(USER, {
      recommendationId: "new",
      issuedAt: hoursAgo(1),
      recommendation: "fresh",
      expectedOutcome: [],
    });
    hydrateOutcomeStore(USER, [
      {
        recommendationId: "old",
        issuedAt: hoursAgo(48),
        recommendation: "from the database",
        expectedOutcome: [],
        observedSignals: [],
        evaluation: "inconclusive",
        confidenceBefore: 0.5,
        evidence: [],
      },
    ]);
    expect(
      getTrackedOutcomes(USER)
        .map((o) => o.recommendationId)
        .sort(),
    ).toEqual(["new", "old"]);
  });

  it("orders newest first and is idempotent", () => {
    const stored = [
      {
        recommendationId: "a",
        issuedAt: hoursAgo(72),
        recommendation: "a",
        expectedOutcome: [],
        observedSignals: [],
        evaluation: "inconclusive" as const,
        confidenceBefore: 0.5,
        evidence: [],
      },
      {
        recommendationId: "b",
        issuedAt: hoursAgo(24),
        recommendation: "b",
        expectedOutcome: [],
        observedSignals: [],
        evaluation: "inconclusive" as const,
        confidenceBefore: 0.5,
        evidence: [],
      },
    ];
    hydrateOutcomeStore(USER, stored);
    hydrateOutcomeStore(USER, stored);
    expect(getTrackedOutcomes(USER).map((o) => o.recommendationId)).toEqual(["b", "a"]);
  });

  it("keeps an already-judged outcome judged", () => {
    hydrateOutcomeStore(USER, [
      {
        recommendationId: "done",
        issuedAt: hoursAgo(48),
        recommendation: "already judged",
        expectedOutcome: [],
        observedSignals: ["Freshness 60"],
        evaluation: "supported",
        evaluatedAt: hoursAgo(2),
        confidenceBefore: 0.5,
        evidence: ["Freshness 60"],
      },
    ]);
    const [outcome] = evaluatePendingOutcomes(USER, analytics, undefined, NOW);
    expect(outcome.evaluation).toBe("supported");
    expect(outcome.evaluatedAt).toBe(hoursAgo(2));
  });
});
