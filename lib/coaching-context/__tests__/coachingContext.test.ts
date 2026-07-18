import { describe, expect, it } from "vitest";
import {
  buildCoachingContext,
  estimateCoachingContextTokens,
  serializeCoachingContextForLLM,
} from "../index";
import {
  hybridAthlete,
  longTermGoal,
  lowData,
  noGoal,
  overloadedBlock,
  raceWeekAthlete,
  taperWeek,
} from "./fixtures";

function build(fixture: typeof lowData, opts?: Parameters<typeof buildCoachingContext>[0]["options"]) {
  return buildCoachingContext({
    analytics: fixture.analytics,
    quality: fixture.quality,
    runs: fixture.runs,
    raceGoal: null,
    options: opts,
  });
}

describe("coaching context layer", () => {
  it("builds for low-data athlete without crashing", () => {
    const ctx = build(lowData);
    expect(ctx.generatedAt).toBeTruthy();
    expect(ctx.dataQuality.activityCount).toBeGreaterThan(0);
    expect(ctx.dataQuality.hrCoverage).toBe("low");
    expect(ctx.dataQuality.confidenceLimitations.length).toBeGreaterThan(0);
  });

  it("builds race-week athlete with goal and constraints", () => {
    const f = raceWeekAthlete();
    const ctx = buildCoachingContext({
      analytics: f.analytics,
      quality: f.quality,
      runs: f.runs,
      raceGoal: {
        distance: "hm",
        date: f.analytics.raceReadiness?.raceDate ?? "",
        targetTimeSec: 7200,
      },
      options: { includeForecast: true },
    });
    expect(ctx.goal?.daysUntilRace).toBeLessThanOrEqual(7);
    expect(ctx.constraints.raceWeek || ctx.constraints.tapering).toBe(true);
    expect(ctx.constraints.notes.length).toBeGreaterThan(0);
  });

  it("builds hybrid athlete with modality context", () => {
    const f = hybridAthlete();
    const ctx = buildCoachingContext({
      analytics: f.analytics,
      quality: f.quality,
      runs: f.runs,
    });
    expect(ctx.modalityContext.athleteArchetype).not.toBe("unknown");
    expect(ctx.modalityContext.crossTrainingSummary.length).toBeGreaterThan(10);
  });

  it("handles missing HR data in data quality", () => {
    const ctx = build(lowData);
    expect(ctx.dataQuality.hrCoverage).not.toBe("high");
    const text = serializeCoachingContextForLLM(ctx);
    expect(text).toMatch(/Data limitations/i);
  });

  it("builds without goal", () => {
    const ctx = build(noGoal);
    expect(ctx.goal).toBeUndefined();
    expect(ctx.recentTraining.weeks.length).toBeGreaterThan(0);
  });

  it("builds long-term goal context", () => {
    const ctx = buildCoachingContext({
      analytics: longTermGoal.analytics,
      quality: longTermGoal.quality,
      runs: longTermGoal.runs,
      raceGoal: {
        distance: "marathon",
        date: longTermGoal.analytics.raceReadiness?.raceDate ?? "",
      },
    });
    expect(ctx.goal?.priority).toBe("low");
    expect((ctx.goal?.daysUntilRace ?? 0)).toBeGreaterThan(56);
  });

  it("surfaces overload risks with evidence", () => {
    const f = overloadedBlock();
    const ctx = buildCoachingContext({
      analytics: f.analytics,
      quality: f.quality,
      runs: f.runs,
    });
    expect(ctx.risks.length).toBeGreaterThan(0);
    expect(ctx.risks[0].evidence.length).toBeGreaterThan(0);
    expect(ctx.recentTraining.summary.length).toBeGreaterThan(0);
  });

  it("detects taper week patterns", () => {
    const f = taperWeek();
    const ctx = buildCoachingContext({
      analytics: f.analytics,
      quality: f.quality,
      runs: f.runs,
      raceGoal: { distance: "hm", date: f.analytics.raceReadiness?.raceDate ?? "" },
    });
    expect(
      ctx.constraints.tapering ||
        ctx.recentTraining.keyChanges.some((c) => /taper|down|fewer/i.test(c))
    ).toBe(true);
  });

  it("does not dump raw activities by default", () => {
    const f = noGoal;
    const ctx = buildCoachingContext({
      analytics: f.analytics,
      quality: f.quality,
      runs: f.runs,
    });
    const text = serializeCoachingContextForLLM(ctx);
    expect(text).not.toMatch(/Raw session/i);
    expect(ctx.recentTraining.notableSessions.length).toBeLessThanOrEqual(5);
  });

  it("includes raw sessions only when opted in", () => {
    const f = noGoal;
    const ctx = buildCoachingContext({
      analytics: f.analytics,
      quality: f.quality,
      runs: f.runs,
      options: { includeRawSessions: true },
    });
    const text = serializeCoachingContextForLLM(ctx);
    expect(text).toMatch(/Raw session/i);
  });

  it("serializes deterministically with required sections", () => {
    const ctx = build(noGoal);
    const a = serializeCoachingContextForLLM(ctx);
    const b = serializeCoachingContextForLLM(ctx);
    expect(a).toBe(b);
    expect(a).toContain("## Athlete profile");
    expect(a).toContain("## Current state");
    expect(a).toContain("## Recent training");
    expect(a).toContain("## Constraints");
    expect(a).toContain("## Data limitations");
    expect(estimateCoachingContextTokens(a)).toBeLessThan(8000);
  });

  it("keeps serialized output concise", () => {
    const f = overloadedBlock();
    const ctx = buildCoachingContext({
      analytics: f.analytics,
      quality: f.quality,
      runs: f.runs,
    });
    const text = serializeCoachingContextForLLM(ctx);
    expect(text.length).toBeLessThan(18000);
    expect(text.split("## ").length).toBeLessThan(18);
  });
});
