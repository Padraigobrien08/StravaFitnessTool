export { buildRaceForecastV2 } from "./forecastEngine";
export { computeForecastSensitivity } from "./sensitivity";
export type { SensitivityFactor } from "./sensitivity";
export { scoreForecast, summarizeCalibration } from "./calibration";
export type { LoggedForecast, CalibrationSummary } from "./calibration";
// NOTE: calibrationService touches the DB client (postgres) — import it directly
// from "@/lib/forecasting-v2/calibrationService" on server-only paths, never via
// this barrel (the barrel is pulled into client bundles through the goals view-model).
export {
  evaluateForecastV2,
  evaluateForecastFixture,
  evaluateAllForecastFixtures,
  FORECAST_FIXTURES,
  FORECAST_FIXTURE_BY_ID,
} from "./evaluation";
export type { ForecastEvaluationReport, ValidationRuleResult } from "./evaluation";
export { buildRaceForecastInput } from "./buildInput";
export type {
  RaceForecastInput,
  RaceForecastV2,
  RaceQualityEffort,
  ForecastModelEstimate,
  ForecastContributor,
  ForecastScenario,
  ForecastObservability,
} from "./forecastTypes";
export {
  buildCapabilityModelEstimates,
  computeWeightedCapability,
  distanceRelevanceWeight,
  effortsFromRuns,
} from "./capabilityModels";
