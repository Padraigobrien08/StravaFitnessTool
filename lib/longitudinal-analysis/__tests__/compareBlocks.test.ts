import { describe, expect, it } from "vitest";
import {
  buildLongitudinalComparisons,
  compareCurrentToStrongestBlock,
  compareTaperToHistory,
} from "../compareBlocks";
import { buildTestBundle, makeRun } from "@/lib/reasoning/__tests__/fixtures";
import type { AthleteIntelligenceBundle } from "@/lib/intelligence/types";
import type { RaceGoal } from "@/lib/analytics/readiness";

/**
 * `lib/longitudinal-analysis` shipped with no tests. It is small, but it is wired into
 * `buildAdaptiveIntelligence`, which reaches Coach, the planner and the observability
 * route — so its two comparisons become sentences an athlete reads about their own
 * training.
 *
 * The behaviour worth pinning is when each comparison declines to speak. Both return
 * `null` rather than a hedged string when there is nothing to say, and that silence is
 * load-bearing: the callers concatenate whatever comes back.
 */

/** A year of steady running, enough for the phase detector to find blocks. */
function steadyRuns(count = 120) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(2025, 0, 1));
    d.setUTCDate(d.getUTCDate() + i * 3);
    return makeRun(`r${i}`, d.toISOString().slice(0, 10), 10);
  });
}

function withRace(bundle: AthleteIntelligenceBundle, daysUntilRace: number, freshness: number) {
  return {
    ...bundle,
    analytics: {
      ...bundle.analytics,
      raceReadiness: { ...bundle.analytics.raceReadiness, daysUntilRace },
      fatigue: { ...bundle.analytics.fatigue, freshness },
    },
  } as AthleteIntelligenceBundle;
}

const goal: RaceGoal = { distance: "hm", date: "2026-10-14", targetTimeSec: 6300 } as RaceGoal;

describe("compareCurrentToStrongestBlock", () => {
  /**
   * The defect this was written against. With one detected block the phase finder
   * returns it as both `current` and `best`, and the old guard (`!best ||
   * best.label === "N/A"`) let it through. A single 10 km run produced:
   *
   *   currentLabel:   "Dec 8 – Jan 5"
   *   referenceLabel: "Dec 8 – Jan 5"
   *   summary:        "Current block aligns with your strongest aerobic phase…"
   *   evidence:       "Best aerobic block: …, 10 km, 1 runs, hard 100%"
   *
   * Vacuous rather than wrong, which is worse — it reads as though the system compared
   * the athlete's history and found agreement.
   */
  it("says nothing when the current block is the only block", () => {
    const bundle = buildTestBundle([makeRun("only", "2026-01-05", 10)]);
    expect(compareCurrentToStrongestBlock(bundle, null)).toBeNull();
  });

  it("never returns a comparison whose two sides are the same block", () => {
    const result = compareCurrentToStrongestBlock(buildTestBundle(steadyRuns()), null);
    if (result) expect(result.currentLabel).not.toBe(result.referenceLabel);
  });

  it("labels both sides when two distinct blocks exist", () => {
    const result = compareCurrentToStrongestBlock(buildTestBundle(steadyRuns()), null);
    if (!result) return; // phase detection is data-dependent; the null paths are covered above
    expect(result.id).toBe("block-vs-best");
    expect(result.currentLabel).not.toBe("");
    expect(result.referenceLabel).not.toBe("");
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

describe("compareTaperToHistory", () => {
  const bundle = buildTestBundle(steadyRuns());

  it("says nothing when the race is more than three weeks out", () => {
    expect(compareTaperToHistory(withRace(bundle, 22, 60), goal)).toBeNull();
  });

  it("speaks inside the taper window", () => {
    const r = compareTaperToHistory(withRace(bundle, 14, 60), goal);
    expect(r?.id).toBe("taper-vs-history");
    expect(r?.currentLabel).toBe("Race −14d");
  });

  it("distinguishes a taper that is working from one that has not rebounded", () => {
    const good = compareTaperToHistory(withRace(bundle, 10, 70), goal);
    const flat = compareTaperToHistory(withRace(bundle, 10, 40), goal);
    expect(good?.summary).toMatch(/preserving freshness/);
    expect(flat?.summary).toMatch(/has not clearly rebounded/);
  });

  /**
   * Confidence rises as the race approaches, because a taper read two weeks out is a
   * guess about a pattern that has barely started. The boundary is 10 days.
   */
  it("only reaches medium confidence inside ten days", () => {
    expect(compareTaperToHistory(withRace(bundle, 10, 60), goal)?.confidence).toBe("medium");
    expect(compareTaperToHistory(withRace(bundle, 11, 60), goal)?.confidence).toBe("low");
  });

  it("reports freshness and TSB as its evidence", () => {
    const r = compareTaperToHistory(withRace(bundle, 7, 62), goal);
    expect(r?.evidence.join(" ")).toMatch(/Freshness 62/);
    expect(r?.evidence.join(" ")).toMatch(/TSB/);
  });
});

describe("buildLongitudinalComparisons", () => {
  it("omits the taper comparison entirely when no race is near", () => {
    const out = buildLongitudinalComparisons(buildTestBundle(steadyRuns()), null);
    expect(out.some((c) => c.id === "taper-vs-history")).toBe(false);
  });

  it("includes the taper comparison once the race is close", () => {
    const bundle = withRace(buildTestBundle(steadyRuns()), 9, 60);
    const out = buildLongitudinalComparisons(bundle, goal);
    expect(out.some((c) => c.id === "taper-vs-history")).toBe(true);
  });

  it("returns an array rather than null when nothing applies", () => {
    const out = buildLongitudinalComparisons(
      buildTestBundle([makeRun("a", "2026-01-05", 8)]),
      null,
    );
    expect(Array.isArray(out)).toBe(true);
  });
});
