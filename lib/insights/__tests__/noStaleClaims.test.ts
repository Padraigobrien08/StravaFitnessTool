import { describe, expect, it } from "vitest";
import { computeInsights } from "@/lib/analytics";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { generateInsights } from "@/lib/insights/generate";
import { getAthleteIntelligenceState } from "@/lib/intelligence/athleteState";
import {
  getActiveSignals,
  getRisksAndOpportunities,
  getPrimaryRecommendation,
  getCoachingStateBullets,
} from "@/lib/intelligence/athleteState";
import { buildAdaptiveSnapshotFromAnalytics } from "@/lib/intelligence/adaptiveState";
import { buildHomeOperatingSystemView } from "@/lib/home/operatingSystemView";
import {
  buildCurrentBelief,
  dedupeIntelligenceSlots,
  getStateEvolutionStrip,
} from "@/lib/intelligence/presentation";
import { mkRun, mkImport } from "@/lib/coaching-context/__tests__/fixtures";
import type { RunActivity } from "@/lib/strava/types";

/**
 * The safety net for insight consistency.
 *
 * Gating each generator individually is precise but forgettable: an earlier pass
 * fixed the two generators that had been measured on Home and missed six others,
 * including one that described an 11-day layoff as a "taper effect" and another
 * that re-introduced the "quality session window" claim through a different
 * path. This asserts on the *composed output* instead, so a new generator cannot
 * quietly reintroduce the class of bug.
 */

/**
 * Phrases no surface may show an athlete who has not run in a week and a half.
 *
 * Past-tense framing is the intended escape hatch and is deliberately not
 * banned: "Last block was intensity-heavy" is true and useful, while "Training
 * looks intensity-heavy" is a claim about training that is not happening.
 */
const BANNED_WHEN_STALE: { pattern: RegExp; why: string }[] = [
  { pattern: /quality (session )?window/i, why: "offers a quality window to someone not training" },
  {
    pattern: /support (a )?quality|support freshness/i,
    why: "sanctions quality work off stale data",
  },
  { pattern: /freshness (is )?high/i, why: "reads a layoff as sharpness" },
  { pattern: /taper effect/i, why: "calls a layoff a taper" },
  { pattern: /fatigue or heat/i, why: "blames fatigue for a dip while resting" },
  { pattern: /fatigue or intensity may be masking/i, why: "blames fatigue while resting" },
  { pattern: /check fatigue/i, why: "attributes a stale signal to fatigue" },
  {
    pattern: /\b(is|are|looks|remains|appears)\b[^.]{0,30}intensity[- ]heavy/i,
    why: "claims heavy intensity with no recent running",
  },
  { pattern: /are appearing regularly/i, why: "present tense about training that stopped" },
  { pattern: /appears to be landing/i, why: "present tense about sessions that stopped" },
  { pattern: /current block is translating/i, why: "present tense about a finished block" },
  { pattern: /upcoming key run/i, why: "invents a scheduled session" },
];

/** A real block of training, then nothing for 11 days: the live account's shape. */
function blockThenGap(gapDays = 11): RunActivity[] {
  const runs: RunActivity[] = [];
  for (let i = 0; i < 18; i++) {
    const daysAgo = gapDays + (18 - i) * 3;
    runs.push(mkRun(daysAgo, { distanceM: 11000, movingSec: 3000 + i * 30, avgHr: 150 }));
  }
  return runs;
}

/** Composes the real surfaces the way app/home/page.tsx and Intelligence do. */
function compose(runs: RunActivity[]) {
  const data = mkImport(runs);
  const analytics = computeInsights(data, []);
  const quality = assessImportQuality(data);
  const insights = generateInsights(analytics, quality);
  const state = getAthleteIntelligenceState(analytics, insights, null, [])!;
  const adaptive = buildAdaptiveSnapshotFromAnalytics(
    { analytics, insights, quality, runs, fitDetails: [] },
    null,
  );
  // Mirrors hooks/use-athlete-intelligence.ts.
  const slots = dedupeIntelligenceSlots({
    primaryRecommendation: getPrimaryRecommendation(state, analytics),
    risksAndOpportunities: getRisksAndOpportunities(state),
    coachingBullets: getCoachingStateBullets(state, analytics),
    recentlyLearned: adaptive.recentlyLearned,
  });

  const home = buildHomeOperatingSystemView({
    analytics,
    insights,
    state,
    risksAndOpportunities: getRisksAndOpportunities(state),
    savedWeek: null,
    signals: getActiveSignals(state, analytics),
    memory: [],
    recentlyLearned: adaptive.recentlyLearned,
    adaptationSignals: adaptive.adaptationSignals.map((s) => s.statement),
  });

  return { analytics, insights, state, adaptive, slots, home };
}

/** Every user-visible string the composed surfaces would render. */
function surfaceStrings(runs: RunActivity[]): string[] {
  const { analytics, insights, state, adaptive, slots, home } = compose(runs);

  const out: string[] = [
    // Home
    home.today.title,
    home.today.why,
    home.today.stateLine,
    home.hero.currentBelief,
    home.hero.primaryAction,
    ...home.hero.whyBullets,
    ...home.primaryActionBullets,
    ...home.risks.map((r) => r.text),
    ...home.opportunities.map((o) => o.text),
    ...home.changeFeed.map((c) => c.text),
    // Intelligence
    buildCurrentBelief(state, analytics),
    slots.primaryRecommendation,
    ...slots.coachingBullets,
    ...slots.risksAndOpportunities.map((r) => r.text),
    ...slots.recentlyLearned,
    ...getActiveSignals(state, analytics).map((s) => s.headline),
    ...adaptive.adaptationSignals.map((s) => s.statement),
    ...adaptive.sessionSummary,
    adaptive.primaryRecommendation,
    ...getStateEvolutionStrip(analytics).flatMap((t) => [t.label, t.direction, t.interpretation]),
    // Insight cards
    ...insights.flatMap((i) => [i.title, ...(i.evidence ?? []), i.recommendation ?? ""]),
  ];
  return out.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

describe("no surface makes a stale claim", () => {
  const runs = blockThenGap(11);
  const strings = surfaceStrings(runs);

  it("has actually built a stale athlete to test against", () => {
    const analytics = computeInsights(mkImport(runs), []);
    expect(analytics.fatigue.readiness.currency).not.toBe("current");
    expect(analytics.fatigue.restDaysSinceLastRun).toBeGreaterThanOrEqual(8);
    expect(strings.length).toBeGreaterThan(15);
  });

  for (const { pattern, why } of BANNED_WHEN_STALE) {
    it(`never ${why}`, () => {
      const offenders = strings.filter((s) => pattern.test(s));
      expect(offenders, `${offenders.length} string(s) matched ${pattern}`).toEqual([]);
    });
  }

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  it("does not repeat one sentence across Home's slots", () => {
    const { home } = compose(runs);
    const slots = [
      ...home.risks.map((r) => r.text),
      ...home.opportunities.map((o) => o.text),
      ...home.primaryActionBullets,
    ];
    const keys = slots.map(norm);
    expect(new Set(keys).size, `repeated: ${slots.join(" | ")}`).toBe(keys.length);
  });

  it("does not repeat one sentence across Intelligence's slots", () => {
    const { slots } = compose(runs);
    const lines = [
      slots.primaryRecommendation,
      ...slots.risksAndOpportunities.map((r) => r.text),
      ...slots.coachingBullets,
      ...slots.recentlyLearned,
    ];
    const keys = lines.map(norm);
    expect(new Set(keys).size, `repeated: ${lines.join(" | ")}`).toBe(keys.length);
  });
});

describe("a currently training athlete is unaffected", () => {
  // The whole point is to suppress claims that are wrong, not to mute the app.
  it("still says plenty, and may legitimately mention quality work", () => {
    const runs: RunActivity[] = [];
    for (let d = 60; d >= 0; d -= 2) runs.push(mkRun(d, { distanceM: 11000, avgHr: 150 }));
    const strings = surfaceStrings(runs);
    expect(strings.length).toBeGreaterThan(15);
    const analytics = computeInsights(mkImport(runs), []);
    expect(analytics.fatigue.readiness.currency).toBe("current");
  });
});
