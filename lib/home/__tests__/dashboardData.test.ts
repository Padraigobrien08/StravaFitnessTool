import { describe, expect, it } from "vitest";
import {
  buildGoalMission,
  buildHeroView,
  buildImprovementView,
  buildInsightRows,
  buildKpis,
  buildNextWeekOps,
  buildProgressionView,
  buildRiskOpportunityRows,
  buildThisWeekOps,
} from "../dashboardData";
import { computeInsights } from "@/lib/analytics";
import { generateInsights } from "@/lib/insights/generate";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { buildDemoImport, demoRaceGoal } from "@/lib/demo/generateDemoData";

// Drive the view-model builders from a full, realistic DashboardInsights derived
// from the demo athlete (12 months of runs) rather than a brittle hand fixture.
const NOW = new Date("2026-07-17T09:00:00.000Z");
const demo = buildDemoImport(NOW);
const raceGoal = demoRaceGoal(NOW);
const analytics = computeInsights(demo, [], 3, raceGoal);
const quality = assessImportQuality(demo);
const insights = generateInsights(analytics, quality);

describe("buildHeroView", () => {
  const hero = buildHeroView(insights, analytics);

  it("produces headline copy and a readiness/freshness summary", () => {
    expect(hero.title.length).toBeGreaterThan(0);
    expect(hero.interpretation.length).toBeGreaterThan(0);
    expect(hero.readinessScore).toBeGreaterThanOrEqual(0);
    expect(hero.readinessScore).toBeLessThanOrEqual(100);
    expect(typeof hero.freshness).toBe("number");
    expect(Array.isArray(hero.whyBullets)).toBe(true);
    expect(Array.isArray(hero.loadSparkline)).toBe(true);
  });

  it("exposes inline metrics as label/value pairs", () => {
    for (const m of hero.inlineMetrics) {
      expect(typeof m.label).toBe("string");
      expect(typeof m.value).toBe("string");
    }
  });
});

describe("buildKpis", () => {
  const kpis = buildKpis(analytics);

  it("returns labelled KPI cards with string values and a sparkline", () => {
    expect(kpis.length).toBeGreaterThan(0);
    for (const k of kpis) {
      expect(k.label.length).toBeGreaterThan(0);
      expect(typeof k.value).toBe("string");
      expect(Array.isArray(k.sparkline)).toBe(true);
    }
  });
});

describe("buildThisWeekOps / buildNextWeekOps", () => {
  it("returns a 7-slot lane and internally consistent session chips", () => {
    for (const ops of [buildThisWeekOps(analytics), buildNextWeekOps(analytics)]) {
      expect(ops.weekLabel.length).toBeGreaterThan(0);
      expect(ops.laneByDay).toHaveLength(7);
      expect(ops.runCount).toBe(ops.sessions.length);
      for (const s of ops.sessions) {
        expect(s.dayIndex).toBeGreaterThanOrEqual(0);
        expect(s.dayIndex).toBeLessThan(7);
        expect(s.intensityPct).toBeGreaterThanOrEqual(0);
        expect(s.intensityPct).toBeLessThanOrEqual(100);
      }
      // Every laned chip sits in the slot matching its dayIndex.
      ops.laneByDay.forEach((chip, day) => {
        if (chip) expect(chip.dayIndex).toBe(day);
      });
    }
  });
});

describe("buildInsightRows", () => {
  const rows = buildInsightRows(analytics, insights);

  it("returns well-formed risk/opportunity rows with unique ids", () => {
    for (const row of rows) {
      expect(["risk", "opportunity"]).toContain(row.kind);
      expect(["risk", "caution", "positive"]).toContain(row.severity);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(row.pills)).toBe(true);
    }
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is the same builder aliased as buildRiskOpportunityRows", () => {
    expect(buildRiskOpportunityRows).toBe(buildInsightRows);
  });
});

describe("buildProgressionView", () => {
  const view = buildProgressionView(analytics, insights);

  it("returns trend mini-charts and achievement/comparison collections", () => {
    expect(view.trajectory.length).toBeGreaterThan(0);
    for (const t of [view.trends.efficiency, view.trends.volume, view.trends.pace]) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(Array.isArray(t.data)).toBe(true);
    }
    expect(Array.isArray(view.achievements)).toBe(true);
    expect(Array.isArray(view.milestones)).toBe(true);
    expect(Array.isArray(view.comparisons)).toBe(true);
  });

  it("is re-exported as buildImprovementView", () => {
    expect(buildImprovementView).toBe(buildProgressionView);
  });
});

describe("buildGoalMission", () => {
  const mission = buildGoalMission(analytics);

  it("returns a scored mission with segments and a link", () => {
    expect(mission.score).toBeGreaterThanOrEqual(0);
    expect(mission.score).toBeLessThanOrEqual(100);
    expect(mission.label.length).toBeGreaterThan(0);
    expect(mission.href.startsWith("/")).toBe(true);
    for (const seg of mission.segments) {
      expect(seg.label.length).toBeGreaterThan(0);
      expect(typeof seg.score).toBe("number");
    }
    expect(Array.isArray(mission.focusAreas)).toBe(true);
  });
});
