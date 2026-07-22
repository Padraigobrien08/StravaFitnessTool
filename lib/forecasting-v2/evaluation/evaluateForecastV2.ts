import { buildRaceForecastV2 } from "../forecastEngine";
import type { RaceForecastInput, RaceForecastV2 } from "../forecastTypes";
import type {
  ForecastEvaluationObservability,
  ForecastEvaluationReport,
  ForecastFixtureProfile,
} from "./evaluationTypes";
import { evaluateFixtureExpectations } from "./fixtureExpectations";
import { FORECAST_FIXTURE_BY_ID, FORECAST_FIXTURES } from "./fixtures";
import { runRecommendationRules } from "./recommendationRules";
import { runSanityRules } from "./sanityRules";

export type EvaluateForecastV2Options = {
  /** Skip building — evaluate an existing forecast */
  forecast?: RaceForecastV2;
  /** Run fixture profile expectations (id from FORECAST_FIXTURES) */
  fixtureId?: string;
};

function buildObservability(
  forecast: RaceForecastV2,
  rules: ForecastEvaluationReport["rules"],
): ForecastEvaluationObservability {
  const failedRules = rules.filter((r) => !r.passed);
  const passedRules = rules.filter((r) => r.passed);

  const recommendationBasis: string[] = [
    forecast.recommendation,
    ...forecast.evidence
      .filter((e) => e.label === "Freshness" || e.label === "Execution")
      .map((e) => e.detail),
    ...forecast.observability.componentBreakdown.map((c) => `${c.component}: ${c.explanation}`),
  ];

  return {
    modelEstimates: forecast.modelEstimates,
    modelWeights: forecast.observability.modelWeights,
    componentScores: forecast.componentScores,
    contributors: forecast.contributors,
    uncertaintyDrivers: forecast.uncertaintyDrivers,
    recommendationBasis,
    evidenceChain: forecast.observability.evidenceChain,
    warnings: [
      ...forecast.observability.warnings,
      ...failedRules.map((r) => `[${r.ruleId}] ${r.message}`),
    ],
    failedRules,
    passedRules,
  };
}

export function evaluateForecastV2(
  input: RaceForecastInput,
  options: EvaluateForecastV2Options = {},
): ForecastEvaluationReport {
  const forecast = options.forecast ?? buildRaceForecastV2(input);

  const sanity = runSanityRules(input, forecast);
  const recommendation = runRecommendationRules(input, forecast);
  const rules = [...sanity, ...recommendation];

  const errorCount = rules.filter((r) => !r.passed && r.severity === "error").length;
  const warningCount = rules.filter(
    (r) => !r.passed && (r.severity === "warning" || r.severity === "error"),
  ).length;

  const observability = buildObservability(forecast, rules);

  const report: ForecastEvaluationReport = {
    passed: errorCount === 0,
    errorCount,
    warningCount,
    forecast,
    input,
    rules,
    observability,
  };

  const fixtureId = options.fixtureId;
  if (fixtureId) {
    const profile = FORECAST_FIXTURE_BY_ID[fixtureId];
    if (profile) {
      report.fixtureExpectation = evaluateFixtureExpectations(profile, forecast, report);
      if (!report.fixtureExpectation.met) {
        report.passed = false;
      }
    }
  }

  return report;
}

export function evaluateForecastFixture(profile: ForecastFixtureProfile): ForecastEvaluationReport {
  return evaluateForecastV2(profile.input, { fixtureId: profile.id });
}

export function evaluateAllForecastFixtures(): {
  profiles: ForecastFixtureProfile[];
  reports: ForecastEvaluationReport[];
  productionReady: boolean;
} {
  const profiles = FORECAST_FIXTURES;
  const reports = profiles.map((p) => evaluateForecastFixture(p));
  const productionReady = reports.every(
    (r) =>
      r.errorCount === 0 &&
      (r.fixtureExpectation?.met ?? true) &&
      r.rules.filter((x) => !x.passed && x.severity === "error").length === 0,
  );
  return { profiles, reports, productionReady };
}
