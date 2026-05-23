import { differenceInDays, parseISO } from "date-fns";
import type { RaceForecastInput, RaceForecastV2 } from "../forecastTypes";
import type { ValidationRuleResult } from "./evaluationTypes";

function pass(
  ruleId: string,
  message: string,
  evidence?: string[]
): ValidationRuleResult {
  return {
    ruleId,
    category: "recommendation",
    passed: true,
    severity: "info",
    message,
    evidence,
  };
}

function fail(
  ruleId: string,
  severity: ValidationRuleResult["severity"],
  message: string,
  evidence?: string[]
): ValidationRuleResult {
  return {
    ruleId,
    category: "contradiction",
    passed: false,
    severity,
    message,
    evidence,
  };
}

const CONFIDENCE_RANK: Record<RaceForecastV2["confidence"], number> = {
  low: 0,
  medium: 1,
  medium_high: 2,
  high: 3,
};

function daysUntilRace(input: RaceForecastInput): number | null {
  if (!input.goal.raceDate) return null;
  try {
    return differenceInDays(parseISO(input.goal.raceDate), new Date());
  } catch {
    return null;
  }
}

function recLower(forecast: RaceForecastV2): string {
  return forecast.recommendation.toLowerCase();
}

export function runRecommendationRules(
  input: RaceForecastInput,
  forecast: RaceForecastV2
): ValidationRuleResult[] {
  const rules: ValidationRuleResult[] = [];
  const rec = recLower(forecast);
  const days = daysUntilRace(input);

  // Engine hardcodes "Confidence: medium-high." — flag mismatch
  const recClaimsHigh =
    rec.includes("medium-high") || rec.includes("high confidence");
  const actualLow = CONFIDENCE_RANK[forecast.confidence] <= 1;
  if (!recClaimsHigh || !actualLow) {
    rules.push(
      pass(
        "recommendation_confidence_alignment",
        "Recommendation confidence text matches forecast confidence."
      )
    );
  } else {
    rules.push(
      fail(
        "recommendation_confidence_alignment",
        "warning",
        `Recommendation claims high confidence but forecast is ${forecast.confidence}.`,
        [forecast.recommendation.slice(0, 120)]
      )
    );
  }

  const raceWeek = days != null && days >= 0 && days <= 7;
  const fatigued = forecast.componentScores.freshness < 50;
  const volumeUp =
    /increase volume|add volume|build (mileage|volume)|more weekly volume/.test(rec);
  if (!(raceWeek && fatigued && volumeUp)) {
    rules.push(
      pass(
        "race_week_no_volume_push",
        "No volume-increase advice during race week with elevated fatigue."
      )
    );
  } else {
    rules.push(
      fail(
        "race_week_no_volume_push",
        "error",
        "Recommends increasing volume during race week despite fatigue signals.",
        [`${days} days to race`, rec.slice(0, 100)]
      )
    );
  }

  const raceReady =
    /race.?ready|on track for goal|target is within reach/i.test(rec) ||
    (forecast.targetAnalysis?.realistic && rec.includes("within reach"));
  const weakDurability = forecast.componentScores.durability < 50;
  if (!(raceReady && weakDurability)) {
    rules.push(
      pass(
        "race_ready_durability_alignment",
        "Race-ready language is not paired with weak durability."
      )
    );
  } else {
    rules.push(
      fail(
        "race_ready_durability_alignment",
        "warning",
        "Suggests race readiness while durability score is weak.",
        [`durability ${forecast.componentScores.durability}`]
      )
    );
  }

  if (!(CONFIDENCE_RANK[forecast.confidence] >= 3 && input.efforts.length < 3)) {
    rules.push(
      pass(
        "high_confidence_requires_data",
        "High confidence is not paired with very sparse efforts."
      )
    );
  } else {
    rules.push(
      fail(
        "high_confidence_requires_data",
        "error",
        `High confidence with only ${input.efforts.length} race-quality effort(s).`
      )
    );
  }

  const strengthPositive = forecast.contributors.positive.some((c) =>
    /strength/i.test(c.label + c.evidence)
  );
  const strengthInterfering =
    /strength.*(interfer|compet|crowd|fatigue)/i.test(rec) ||
    forecast.limitations.some((l) =>
      /strength.*(interfer|timing)/i.test(l.detail)
    );
  const strengthNuanced =
    /strength.*(support|maintain|limit|timing)/i.test(rec) && strengthInterfering;
  if (!(strengthPositive && strengthInterfering && !strengthNuanced)) {
    rules.push(
      pass(
        "strength_narrative_coherence",
        "Strength support and interference are not contradictory."
      )
    );
  } else {
    rules.push(
      fail(
        "strength_narrative_coherence",
        "warning",
        "Strength cited as positive contributor while recommendation implies interference without nuance."
      )
    );
  }

  const nonRunImproves = forecast.contributors.positive.some(
    (c) =>
      c.component === "capability" &&
      /cycle|strength|swim|modal/i.test(c.evidence + c.label) &&
      !/fatigue|only/i.test(c.evidence)
  );
  if (!nonRunImproves) {
    rules.push(
      pass(
        "non_run_capability_calibration",
        "Non-run modalities do not directly improve race pace prediction."
      )
    );
  } else {
    rules.push(
      fail(
        "non_run_capability_calibration",
        "warning",
        "Non-run work appears to improve capability prediction without calibration caveat."
      )
    );
  }

  const aggressiveWhileFatigued =
    fatigued &&
    /add (a |another )?hard|stack|intensity block|threshold session/.test(rec);
  if (!aggressiveWhileFatigued) {
    rules.push(
      pass(
        "fatigue_no_aggressive_intensity",
        "Fatigued state does not recommend stacking hard sessions."
      )
    );
  } else {
    rules.push(
      fail(
        "fatigue_no_aggressive_intensity",
        "warning",
        "Fatigue-heavy profile but recommendation adds hard intensity.",
        [rec.slice(0, 120)]
      )
    );
  }

  const hasLimitation = forecast.limitations.length > 0;
  if (hasLimitation) {
    rules.push(
      pass(
        "recommendation_acknowledges_limitations",
        "Forecast surfaces at least one limitation alongside recommendation."
      )
    );
  } else {
    rules.push(
      fail(
        "recommendation_acknowledges_limitations",
        "warning",
        "Recommendation issued without documented limitations."
      )
    );
  }

  return rules;
}
