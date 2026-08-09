import { describe, expect, it } from "vitest";
import { buildRaceForecastV2 } from "../../forecastEngine";
import {
  evaluateAllForecastFixtures,
  evaluateForecastFixture,
  evaluateForecastV2,
} from "../evaluateForecastV2";
import {
  FORECAST_FIXTURES,
  hmReadyRunnerInput,
  inconsistentModelEstimatesInput,
  lowDataRunnerInput,
  missingHrDataAthleteInput,
  strong5kNoLongRunsInput,
} from "../fixtures";
import { runSanityRules } from "../sanityRules";
import { runRecommendationRules } from "../recommendationRules";

describe("evaluateForecastV2 sanity rules", () => {
  it("passes interval ordering for hm-ready runner", () => {
    const forecast = buildRaceForecastV2(hmReadyRunnerInput);
    const rules = runSanityRules(hmReadyRunnerInput, forecast);
    const intervalRules = rules.filter((r) => r.category === "interval");
    expect(intervalRules.every((r) => r.passed)).toBe(true);
    expect(forecast.conservativeTimeSec).toBeGreaterThanOrEqual(forecast.mostLikelyTimeSec);
    expect(forecast.optimisticTimeSec).toBeLessThanOrEqual(forecast.mostLikelyTimeSec);
  });

  it("flags inverted conservative/most-likely when tampered", () => {
    const forecast = buildRaceForecastV2(hmReadyRunnerInput);
    const bad = {
      ...forecast,
      conservativeTimeSec: forecast.mostLikelyTimeSec - 120,
    };
    const failed = runSanityRules(hmReadyRunnerInput, bad).find(
      (r) => r.ruleId === "conservative_slower_than_most_likely",
    );
    expect(failed?.passed).toBe(false);
    expect(failed?.severity).toBe("error");
  });

  it("warns when low specificity has narrow interval", () => {
    const forecast = buildRaceForecastV2(strong5kNoLongRunsInput);
    const rule = runSanityRules(strong5kNoLongRunsInput, forecast).find(
      (r) =>
        r.ruleId === "low_specificity_widens_uncertainty" ||
        r.ruleId === "high_agreement_low_specificity",
    );
    expect(forecast.componentScores.specificity).toBeLessThan(40);
    expect(rule?.passed === false || forecast.confidence === "low").toBe(true);
  });

  it("caps marathon confidence on 5K-only evidence", () => {
    const forecast = buildRaceForecastV2(strong5kNoLongRunsInput);
    const rule = runSanityRules(strong5kNoLongRunsInput, forecast).find(
      (r) => r.ruleId === "short_anchor_marathon_confidence",
    );
    expect(rule?.passed).toBe(true);
    expect(forecast.confidence).not.toBe("high");
  });
});

describe("recommendation contradiction detection", () => {
  it("flags recommendation confidence mismatch for low-data forecast", () => {
    const forecast = buildRaceForecastV2(lowDataRunnerInput);
    const rule = runRecommendationRules(lowDataRunnerInput, forecast).find(
      (r) => r.ruleId === "recommendation_confidence_alignment",
    );
    expect(forecast.confidence).toMatch(/low|medium/);
    if (forecast.recommendation.toLowerCase().includes("medium-high")) {
      expect(rule?.passed).toBe(false);
    }
  });

  it("race-week taper forbids volume increase phrasing", () => {
    const report = evaluateForecastFixture(
      FORECAST_FIXTURES.find((f) => f.id === "race_week_taper")!,
    );
    expect(report.fixtureExpectation?.met).toBe(true);
    const volumeRule = report.rules.find((r) => r.ruleId === "race_week_no_volume_push");
    expect(volumeRule?.passed).toBe(true);
  });

  it("fatigue-heavy recommendation avoids volume push", () => {
    const report = evaluateForecastFixture(
      FORECAST_FIXTURES.find((f) => f.id === "fatigue_heavy")!,
    );
    expect(report.fixtureExpectation?.met).toBe(true);
    expect(report.forecast.recommendation.toLowerCase()).toMatch(/freshness|hard/);
  });
});

describe("fixture athletes", () => {
  it.each(FORECAST_FIXTURES.map((f) => [f.id, f] as const))(
    "%s produces a complete evaluation report",
    (_id, profile) => {
      const report = evaluateForecastFixture(profile);
      expect(report.forecast.mostLikelyTimeSec).toBeGreaterThan(0);
      expect(report.rules.length).toBeGreaterThan(10);
      expect(report.observability.modelEstimates.length).toBeGreaterThan(0);
      expect(report.observability.failedRules.length).toBeGreaterThanOrEqual(0);
      expect(report.observability.passedRules.length).toBeGreaterThan(0);
    },
  );

  it("low-data runner has capped confidence and warnings", () => {
    const report = evaluateForecastV2(lowDataRunnerInput, {
      fixtureId: "low_data",
    });
    expect(report.forecast.confidence).not.toBe("high");
    expect(report.fixtureExpectation?.met).toBe(true);
  });

  it("hm-ready runner meets fixture expectations with no errors", () => {
    const report = evaluateForecastV2(hmReadyRunnerInput, {
      fixtureId: "hm_ready",
    });
    expect(report.errorCount).toBe(0);
    expect(report.fixtureExpectation?.met).toBe(true);
  });

  it("inconsistent models widen uncertainty", () => {
    const report = evaluateForecastV2(inconsistentModelEstimatesInput, {
      fixtureId: "inconsistent_models",
    });
    const width =
      report.forecast.predictionIntervalSec.outerHighSec -
      report.forecast.predictionIntervalSec.outerLowSec;
    expect(width).toBeGreaterThanOrEqual(180);
    expect(report.fixtureExpectation?.met).toBe(true);
  });

  it("missing HR caps high confidence", () => {
    const report = evaluateForecastV2(missingHrDataAthleteInput, {
      fixtureId: "missing_hr",
    });
    expect(report.fixtureExpectation?.met).toBe(true);
    const hrRule = report.rules.find((r) => r.ruleId === "missing_hr_confidence_cap");
    expect(hrRule?.passed).toBe(true);
  });

  it("marathon underprepared surfaces weak durability", () => {
    const report = evaluateForecastFixture(
      FORECAST_FIXTURES.find((f) => f.id === "marathon_underprepared")!,
    );
    expect(report.fixtureExpectation?.met).toBe(true);
    expect(report.forecast.componentScores.durability).toBeLessThan(60);
  });

  it("near-race 20.5k + 10-mile efforts predict HM under 2:00", () => {
    const report = evaluateForecastFixture(
      FORECAST_FIXTURES.find((f) => f.id === "near_race_evidence")!,
    );
    expect(report.fixtureExpectation?.met).toBe(true);
    expect(report.forecast.mostLikelyTimeSec).toBeLessThan(7200);
    expect(report.forecast.mostLikelyTimeSec).toBeGreaterThan(6300);
  });
});

describe("production readiness gate", () => {
  it("all fixtures pass behavioral expectations with zero validation errors", () => {
    const { reports, productionReady } = evaluateAllForecastFixtures();
    expect(reports.length).toBe(10);
    const failures = reports
      .filter((r) => !r.fixtureExpectation?.met || r.errorCount > 0)
      .map(
        (r) =>
          `${r.fixtureExpectation?.fixtureId}: errors=${r.errorCount} ${r.fixtureExpectation?.failures?.join("; ")}`,
      );
    if (failures.length) {
      // Log for debugging; errors block production, fixture failures block too
      expect(failures, failures.join("\n")).toEqual([]);
    }
    expect(productionReady).toBe(true);
  });
});
