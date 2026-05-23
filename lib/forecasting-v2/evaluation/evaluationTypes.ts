import type { RaceForecastInput, RaceForecastV2 } from "../forecastTypes";

export type ValidationSeverity = "error" | "warning" | "info";

export type ValidationCategory =
  | "interval"
  | "models"
  | "confidence"
  | "components"
  | "recommendation"
  | "contradiction"
  | "data_quality";

export type ValidationRuleResult = {
  ruleId: string;
  category: ValidationCategory;
  passed: boolean;
  severity: ValidationSeverity;
  message: string;
  evidence?: string[];
};

export type ForecastEvaluationObservability = {
  modelEstimates: RaceForecastV2["modelEstimates"];
  modelWeights: { modelName: string; weight: number; reason: string }[];
  componentScores: RaceForecastV2["componentScores"];
  contributors: RaceForecastV2["contributors"];
  uncertaintyDrivers: RaceForecastV2["uncertaintyDrivers"];
  recommendationBasis: string[];
  evidenceChain: string[];
  warnings: string[];
  failedRules: ValidationRuleResult[];
  passedRules: ValidationRuleResult[];
};

export type FixtureExpectationResult = {
  fixtureId: string;
  met: boolean;
  failures: string[];
};

export type ForecastEvaluationReport = {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  forecast: RaceForecastV2;
  input: RaceForecastInput;
  rules: ValidationRuleResult[];
  observability: ForecastEvaluationObservability;
  fixtureExpectation?: FixtureExpectationResult;
};

export type ForecastFixtureProfile = {
  id: string;
  label: string;
  description: string;
  input: RaceForecastInput;
  /** Behavioral checks for harness acceptance (not engine changes) */
  expectations: {
    maxConfidence?: RaceForecastV2["confidence"];
    minConfidence?: RaceForecastV2["confidence"];
    requireWarnings?: boolean;
    minIntervalWidthSec?: number;
    maxIntervalWidthSec?: number;
    durabilityLabel?: "weak" | "moderate" | "strong";
    specificityLabel?: "low" | "moderate" | "high";
    freshnessLabel?: "fatigued" | "neutral" | "fresh";
    modelAgreementNotHigh?: boolean;
    mustPassAllRules?: boolean;
    forbidRecommendationPhrases?: string[];
    requireRecommendationPhrases?: string[];
  };
};
