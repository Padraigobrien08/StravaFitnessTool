import { formatLongRunVsRace } from "@/lib/analytics/readiness";
import type {
  DurabilityAssessment,
  ExecutionAssessment,
  ForecastContributor,
  FreshnessAssessment,
  RaceForecastInput,
  SpecificityAssessment,
  UncertaintyAssessment,
} from "./forecastTypes";

export function buildContributors(
  input: RaceForecastInput,
  components: {
    capabilityScore: number;
    durability: DurabilityAssessment;
    freshness: FreshnessAssessment;
    specificity: SpecificityAssessment;
    execution: ExecutionAssessment;
    uncertainty: UncertaintyAssessment;
    modelAgreementLabel: string;
    modelSpreadSec: number;
  },
): {
  positive: ForecastContributor[];
  negative: ForecastContributor[];
  neutral: ForecastContributor[];
} {
  const positive: ForecastContributor[] = [];
  const negative: ForecastContributor[] = [];
  const neutral: ForecastContributor[] = [];

  const targetKm = input.goal.distanceMeters / 1000;
  const longest = input.recentBlocks[input.recentBlocks.length - 1]?.longestRunKm ?? 0;
  const longestPct = targetKm > 0 ? Math.round((longest / targetKm) * 100) : 0;

  if (longestPct >= 85) {
    positive.push({
      label: "Long-run matches race distance",
      direction: "positive",
      magnitude: longestPct >= 98 ? "large" : "medium",
      component: "durability",
      evidence: `Longest run ${formatLongRunVsRace(longest, targetKm)}.`,
      confidence: "high",
    });
  } else if (longestPct < 55 && targetKm >= 18) {
    negative.push({
      label: "Insufficient long-run support",
      direction: "negative",
      magnitude: "large",
      component: "durability",
      evidence: `Longest run ${formatLongRunVsRace(longest, targetKm)}.`,
      confidence: "high",
    });
  }

  if (components.specificity.label === "high") {
    positive.push({
      label: "Target-specific training evidence",
      direction: "positive",
      magnitude: "medium",
      component: "specificity",
      evidence: components.specificity.evidence[0] ?? "Volume and efforts align with target.",
      confidence: "medium",
    });
  } else if (components.specificity.label === "low") {
    negative.push({
      label: "Low race-distance specificity",
      direction: "negative",
      magnitude: "large",
      component: "specificity",
      evidence: components.specificity.gaps[0] ?? "Extrapolation from short anchors.",
      confidence: "high",
    });
  }

  if (components.freshness.label === "fresh") {
    positive.push({
      label: "Freshness supports race-day execution",
      direction: "positive",
      magnitude: "medium",
      component: "freshness",
      evidence: components.freshness.evidence[0] ?? "Freshness elevated.",
      confidence: "medium",
    });
  } else if (components.freshness.label === "fatigued") {
    negative.push({
      label: "Fatigue may weaken race-day outcome",
      direction: "negative",
      magnitude: "medium",
      component: "freshness",
      evidence: components.freshness.risks[0] ?? components.freshness.evidence[0] ?? "",
      confidence: "medium",
    });
  }

  if (components.execution.fadeRisk === "low") {
    positive.push({
      label: "Stable pacing patterns",
      direction: "positive",
      magnitude: "small",
      component: "execution",
      evidence: components.execution.evidence[0] ?? "Execution score supports even effort.",
      confidence: "medium",
    });
  } else if (components.execution.fadeRisk === "high") {
    negative.push({
      label: "Late-race fade risk",
      direction: "negative",
      magnitude: "medium",
      component: "execution",
      evidence: components.execution.recommendation,
      confidence: "medium",
    });
  }

  if (components.modelAgreementLabel === "high") {
    positive.push({
      label: "Strong model agreement",
      direction: "positive",
      magnitude: "medium",
      component: "capability",
      evidence: `Capability models within ${Math.round(components.modelSpreadSec)}s spread.`,
      confidence: "high",
    });
  } else if (components.modelAgreementLabel === "low") {
    negative.push({
      label: "Capability model disagreement",
      direction: "negative",
      magnitude: "large",
      component: "uncertainty",
      evidence: `Models spread ${Math.round(components.modelSpreadSec)}s — widens prediction interval.`,
      confidence: "high",
    });
  }

  if (input.efforts.length < 3) {
    negative.push({
      label: "Limited effort history",
      direction: "negative",
      magnitude: "medium",
      component: "capability",
      evidence: `${input.efforts.length} race-quality efforts available.`,
      confidence: "high",
    });
  }

  if (components.capabilityScore >= 75 && input.efforts.length >= 4) {
    positive.push({
      label: "Multiple quality anchors",
      direction: "positive",
      magnitude: "medium",
      component: "capability",
      evidence: `${input.efforts.length} efforts inform capability curve.`,
      confidence: "high",
    });
  }

  const hard14 = input.athleteContext?.hardRunsLast14d ?? 0;
  if (hard14 >= 5) {
    negative.push({
      label: "Intensity stacking elevated",
      direction: "negative",
      magnitude: "medium",
      component: "freshness",
      evidence: `${hard14} hard sessions in 14 days.`,
      confidence: "high",
    });
  }

  neutral.push({
    label: "No sleep or HRV context",
    direction: "neutral",
    magnitude: "small",
    component: "uncertainty",
    evidence: "Non-run recovery signals not in current data path.",
    confidence: "low",
  });

  return { positive, negative, neutral };
}
