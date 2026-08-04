import { describe, expect, it } from "vitest";
import { buildActiveObservations, buildRisksAndOpportunities } from "../activeIntelligence";
import { insightsFrom, mkRun } from "@/lib/coaching-context/__tests__/fixtures";
import type { RunActivity } from "@/lib/strava/types";
import { detectInterference } from "@/lib/ecosystem/interference";
import type { NormalizedActivity } from "@/lib/ecosystem/types";

/**
 * Insight generators each see one slice of the data, so they can assert things
 * the rest of the state contradicts. These were both live on the real account
 * after 10 days without a run:
 *
 *   "Efficiency has dipped: fatigue or heat may be compressing aerobic returns."
 *   "Threshold-style sessions are appearing regularly (5 in recent mix)."
 *
 * Neither can be true of training that stopped a week and a half ago.
 */

/** Declining efficiency across a block, then optionally a long gap. */
function history(gapDays: number): RunActivity[] {
  const runs: RunActivity[] = [];
  // Older runs faster at the same HR than newer ones, so efficiency declines.
  for (let i = 0; i < 14; i++) {
    const daysAgo = gapDays + (14 - i) * 3;
    runs.push(
      mkRun(daysAgo, {
        distanceM: 10000,
        movingSec: 2700 + i * 40,
        avgHr: 150,
      }),
    );
  }
  return runs;
}

const textOf = (items: { text: string }[]) => items.map((i) => i.text).join(" | ");

describe("claims are consistent with training currency", () => {
  it("does not blame fatigue for a dip once training has stopped", () => {
    const { analytics } = insightsFrom(history(12));
    expect(analytics.fatigue.readiness.currency).not.toBe("current");

    const obs = buildActiveObservations(analytics, []);
    const all = textOf(obs);
    if (/efficiency has dipped/i.test(all)) {
      expect(all).not.toMatch(/fatigue or heat may be compressing/i);
      expect(all).toMatch(/lost sharpness|without a run/i);
    }
  });

  it("does not claim sessions are still appearing after a gap", () => {
    const { analytics } = insightsFrom(history(12));
    const all = textOf(buildActiveObservations(analytics, []));
    expect(all).not.toMatch(/are appearing regularly/i);
  });

  it("keeps the present-tense wording while training is current", () => {
    const { analytics } = insightsFrom(history(0));
    expect(analytics.fatigue.readiness.currency).toBe("current");
    const all = textOf(buildActiveObservations(analytics, []));
    // No regression: the original phrasing survives for a current athlete.
    if (/threshold-style/i.test(all)) {
      expect(all).toMatch(/are appearing regularly/i);
    }
    if (/efficiency has dipped/i.test(all)) {
      expect(all).toMatch(/fatigue or heat may be compressing/i);
    }
  });

  it("carries the correction through to risks, which copy the observations", () => {
    const { analytics } = insightsFrom(history(12));
    const obs = buildActiveObservations(analytics, []);
    const all = textOf(buildRisksAndOpportunities(analytics, obs));
    expect(all).not.toMatch(/fatigue or heat may be compressing/i);
  });
});

describe("interference messages describe what happened", () => {
  // Both sides of an interference pair come from the history being scanned, so
  // a future tense there invents a scheduled session. That was most visible for
  // an athlete with no saved plan and no run in over a week.
  const activity = (over: Partial<NormalizedActivity>): NormalizedActivity =>
    ({
      id: "a",
      source: "strava",
      sportType: "Run",
      modality: "run",
      name: "Activity",
      startDate: "2026-07-01T06:00:00.000Z",
      movingTimeSec: 3600,
      elapsedTimeSec: 3600,
      hasStreams: false,
      hasLaps: false,
      perceivedIntensity: "high",
      intensity: { confidence: "medium", evidence: [] },
      confidence: "medium",
      ...over,
    }) as NormalizedActivity;

  it("describes a gym session before a key run in the past tense", () => {
    const flags = detectInterference([
      activity({
        id: "gym",
        sportType: "WeightTraining",
        modality: "strength",
        startDate: "2026-07-01T06:00:00.000Z",
      }),
      activity({
        id: "run",
        sportType: "Run",
        modality: "run",
        isHardRun: true,
        startDate: "2026-07-02T05:00:00.000Z",
      }),
    ]);
    const messages = flags.map((f) => f.message).join(" | ");
    expect(messages).not.toMatch(/upcoming/i);
    if (flags.length > 0) expect(messages).toMatch(/before a key run|may have been compromised/i);
  });
});
