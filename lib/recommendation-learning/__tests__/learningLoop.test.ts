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
  isObservable,
  MIN_OBSERVATION_HOURS,
  trackRecommendationOutcome,
} from "../index";

/**
 * §DD-1: does the learning loop close?
 *
 * The audit found the three stages — track, evaluate, update beliefs — unit tested in
 * isolation but never driven end to end, and called that the subsystem's central
 * unproven claim. Driving it turned up something worse than a loop that does not
 * close: `buildAdaptiveIntelligence` tracks a recommendation and evaluates pending
 * outcomes in the same call, so every recommendation was graded **in the instant it
 * was issued**, against the very analytics that produced it. "Supported" meant "this
 * advice matched the current state", and a belief captioned "Historical evidence
 * suggests…" was minted on that basis.
 *
 * These tests pin both halves: nothing is judged before an effect could exist, and
 * the loop genuinely closes once it could.
 */

const NOW = new Date("2026-08-05T09:00:00.000Z");
const analytics = computeInsights(buildDemoImport(NOW), [], 4, demoRaceGoal(NOW));
const KEY = "athlete-1";

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

function track(id: string, issuedAt: string) {
  return trackRecommendationOutcome(KEY, {
    recommendationId: id,
    issuedAt,
    recommendation: "Keep intensity easy and protect freshness",
    expectedOutcome: ["freshness", "readiness"],
  });
}

beforeEach(() => clearOutcomeStore());

describe("isObservable", () => {
  it("requires the full window to have elapsed", () => {
    expect(isObservable({ issuedAt: hoursAgo(MIN_OBSERVATION_HOURS + 1) }, NOW)).toBe(true);
    expect(isObservable({ issuedAt: hoursAgo(MIN_OBSERVATION_HOURS) }, NOW)).toBe(true);
    expect(isObservable({ issuedAt: hoursAgo(MIN_OBSERVATION_HOURS - 1) }, NOW)).toBe(false);
    expect(isObservable({ issuedAt: hoursAgo(0) }, NOW)).toBe(false);
  });

  it("refuses to judge an unparseable issue time", () => {
    expect(isObservable({ issuedAt: "not-a-date" }, NOW)).toBe(false);
  });
});

describe("the loop does not close before an effect could exist", () => {
  // The defect: this is what buildAdaptiveIntelligence does on every call.
  it("a recommendation issued this instant is not graded", () => {
    track("rec-now", NOW.toISOString());
    const [outcome] = evaluatePendingOutcomes(KEY, analytics, undefined, NOW);
    expect(outcome.evaluation).toBe("inconclusive");
    expect(outcome.evaluatedAt).toBeFalsy();
  });

  it("and cannot reach a belief", () => {
    track("rec-now", NOW.toISOString());
    const outcomes = evaluatePendingOutcomes(KEY, analytics, undefined, NOW);
    const before = buildAthleteMemoryProfile(analytics, KEY);
    const after = applyOutcomesToMemory(before, outcomes);
    expect(beliefCount(after)).toBe(beliefCount(before));
    expect(after).toEqual(before);
  });

  it("an hour is still too soon", () => {
    track("rec-hour", hoursAgo(1));
    const [outcome] = evaluatePendingOutcomes(KEY, analytics, undefined, NOW);
    expect(outcome.evaluatedAt).toBeFalsy();
  });

  it("leaves it pending rather than discarding it", () => {
    track("rec-hour", hoursAgo(1));
    evaluatePendingOutcomes(KEY, analytics, undefined, NOW);
    expect(getTrackedOutcomes(KEY)).toHaveLength(1);
  });
});

describe("the loop closes once time has passed", () => {
  // §DD-1's acceptance test: a recommendation drives a measurable belief change.
  it("a day-old recommendation is judged and changes the belief profile", () => {
    track("rec-old", hoursAgo(25));
    const outcomes = evaluatePendingOutcomes(KEY, analytics, undefined, NOW);

    expect(outcomes[0].evaluatedAt).toBeTruthy();
    expect(outcomes[0].evaluation).not.toBe("inconclusive");
    expect(outcomes[0].observedSignals.length).toBeGreaterThan(0);

    const before = buildAthleteMemoryProfile(analytics, KEY);
    const after = applyOutcomesToMemory(before, outcomes);
    expect(beliefCount(after)).toBeGreaterThan(beliefCount(before));
  });

  it("the same outcome becomes judgeable as the window elapses", () => {
    track("rec-wait", hoursAgo(2));
    const early = evaluatePendingOutcomes(KEY, analytics, undefined, NOW)[0];
    expect(early.evaluatedAt).toBeFalsy();

    const later = new Date(NOW.getTime() + 30 * 3600_000);
    const ripe = evaluatePendingOutcomes(KEY, analytics, undefined, later)[0];
    expect(ripe.evaluatedAt).toBeTruthy();
  });

  it("a judged outcome is not re-judged on a later pass", () => {
    track("rec-old", hoursAgo(25));
    const first = evaluatePendingOutcomes(KEY, analytics, undefined, NOW)[0];
    const second = evaluatePendingOutcomes(
      KEY,
      analytics,
      undefined,
      new Date(NOW.getTime() + 48 * 3600_000),
    )[0];
    expect(second.evaluatedAt).toBe(first.evaluatedAt);
  });
});

describe("outcomes are scoped per athlete", () => {
  it("one athlete's recommendation does not appear under another's key", () => {
    track("rec", hoursAgo(25));
    expect(getTrackedOutcomes(KEY)).toHaveLength(1);
    expect(getTrackedOutcomes("someone-else")).toHaveLength(0);
  });

  it("evaluating one athlete leaves another untouched", () => {
    track("rec", hoursAgo(25));
    evaluatePendingOutcomes("someone-else", analytics, undefined, NOW);
    expect(getTrackedOutcomes(KEY)[0].evaluatedAt).toBeFalsy();
  });
});

/**
 * The store is an in-memory Map, so a pending outcome does not survive to the next
 * request. With the observation window above, that means the loop rarely closes in a
 * serverless deployment — correct, but mostly inert. Pinned here so the limitation is
 * visible rather than assumed, and so moving onto `lib/db/recommendation-log.ts`
 * has a test to flip.
 */
describe("known limitation: the store does not persist", () => {
  it("a pending outcome is lost on a process restart", () => {
    track("rec-old", hoursAgo(25));
    expect(getTrackedOutcomes(KEY)).toHaveLength(1);
    clearOutcomeStore(); // what a cold start does
    expect(getTrackedOutcomes(KEY)).toHaveLength(0);
  });
});
