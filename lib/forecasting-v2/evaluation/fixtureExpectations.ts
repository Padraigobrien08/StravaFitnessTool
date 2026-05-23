import { assessDurability } from "../durabilityModel";
import { assessFreshness } from "../freshnessModel";
import { assessSpecificity } from "../specificityModel";
import type { RaceForecastV2 } from "../forecastTypes";
import type {
  FixtureExpectationResult,
  ForecastFixtureProfile,
  ForecastEvaluationReport,
} from "./evaluationTypes";

const CONFIDENCE_RANK: Record<RaceForecastV2["confidence"], number> = {
  low: 0,
  medium: 1,
  medium_high: 2,
  high: 3,
};

export function evaluateFixtureExpectations(
  profile: ForecastFixtureProfile,
  forecast: RaceForecastV2,
  report: ForecastEvaluationReport
): FixtureExpectationResult {
  const failures: string[] = [];
  const exp = profile.expectations;
  const rank = CONFIDENCE_RANK[forecast.confidence];
  const intervalWidth =
    forecast.predictionIntervalSec.p90 - forecast.predictionIntervalSec.p10;
  const rec = forecast.recommendation.toLowerCase();

  if (exp.maxConfidence != null && rank > CONFIDENCE_RANK[exp.maxConfidence]) {
    failures.push(
      `Expected confidence ≤ ${exp.maxConfidence}, got ${forecast.confidence}.`
    );
  }
  if (exp.minConfidence != null && rank < CONFIDENCE_RANK[exp.minConfidence]) {
    failures.push(
      `Expected confidence ≥ ${exp.minConfidence}, got ${forecast.confidence}.`
    );
  }

  if (exp.requireWarnings) {
    const warningCount =
      forecast.observability.warnings.length +
      report.rules.filter((r) => !r.passed && r.severity !== "info").length;
    if (warningCount < 1) {
      failures.push("Expected at least one warning or failed validation rule.");
    }
  }

  if (exp.minIntervalWidthSec != null && intervalWidth < exp.minIntervalWidthSec) {
    failures.push(
      `Expected interval width ≥ ${exp.minIntervalWidthSec}s, got ${intervalWidth}s.`
    );
  }
  if (exp.maxIntervalWidthSec != null && intervalWidth > exp.maxIntervalWidthSec) {
    failures.push(
      `Expected interval width ≤ ${exp.maxIntervalWidthSec}s, got ${intervalWidth}s.`
    );
  }

  if (exp.durabilityLabel != null) {
    const d = assessDurability(profile.input);
    if (d.label !== exp.durabilityLabel) {
      failures.push(`Expected durability ${exp.durabilityLabel}, got ${d.label}.`);
    }
  }

  if (exp.specificityLabel != null) {
    const s = assessSpecificity(profile.input);
    if (s.label !== exp.specificityLabel) {
      failures.push(`Expected specificity ${exp.specificityLabel}, got ${s.label}.`);
    }
  }

  if (exp.freshnessLabel != null) {
    const f = assessFreshness(profile.input);
    if (f.label !== exp.freshnessLabel) {
      failures.push(`Expected freshness ${exp.freshnessLabel}, got ${f.label}.`);
    }
  }

  if (exp.modelAgreementNotHigh && forecast.modelAgreement.label === "high") {
    failures.push("Expected model agreement not to be high.");
  }

  if (exp.mustPassAllRules) {
    const errors = report.rules.filter((r) => !r.passed && r.severity === "error");
    if (errors.length > 0) {
      failures.push(
        `Expected all rules to pass; ${errors.length} error(s): ${errors.map((e) => e.ruleId).join(", ")}.`
      );
    }
  }

  for (const phrase of exp.forbidRecommendationPhrases ?? []) {
    if (rec.includes(phrase.toLowerCase())) {
      failures.push(`Recommendation must not include "${phrase}".`);
    }
  }

  for (const phrase of exp.requireRecommendationPhrases ?? []) {
    if (!rec.includes(phrase.toLowerCase())) {
      failures.push(`Recommendation should reference "${phrase}".`);
    }
  }

  return {
    fixtureId: profile.id,
    met: failures.length === 0,
    failures,
  };
}
