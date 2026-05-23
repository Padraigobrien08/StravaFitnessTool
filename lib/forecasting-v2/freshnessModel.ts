import type { RaceForecastInput } from "./forecastTypes";
import type { FreshnessAssessment } from "./forecastTypes";

export function assessFreshness(input: RaceForecastInput): FreshnessAssessment {
  const ctx = input.athleteContext ?? {};
  const evidence: string[] = [];
  const risks: string[] = [];
  let score = 55;
  let timeAdjustmentSec = 0;

  const freshness = ctx.freshnessScore ?? 50;
  const tsb = ctx.tsb ?? 0;
  const hard14 = ctx.hardRunsLast14d ?? 0;

  score = Math.round(Math.max(0, Math.min(100, freshness)));

  if (freshness >= 70) {
    evidence.push(`Freshness ${Math.round(freshness)} — supports quality execution.`);
    timeAdjustmentSec -= Math.round(Math.min(45, (freshness - 65) * 0.8));
  } else if (freshness < 45) {
    evidence.push(`Freshness ${Math.round(freshness)} — fatigue may suppress race-day pace.`);
    timeAdjustmentSec += Math.round((45 - freshness) * 1.2);
    risks.push("Elevated fatigue heading into race window.");
  } else {
    evidence.push(`Freshness ${Math.round(freshness)} — neutral race-day modifier.`);
  }

  if (tsb > 8) {
    evidence.push(`TSB +${Math.round(tsb)} — training balance favors recovery.`);
    if (tsb > 20) {
      risks.push("Very positive TSB after sharp volume drop — confirm taper vs detraining.");
    }
  } else if (tsb < -12) {
    evidence.push(`TSB ${Math.round(tsb)} — acute load may outweigh freshness.`);
    timeAdjustmentSec += Math.round(Math.min(90, Math.abs(tsb) * 2));
    risks.push("Fatigue balance strained — late-race fade risk elevated.");
  }

  if (hard14 >= 5) {
    score -= 8;
    timeAdjustmentSec += 25;
    risks.push(`${hard14} hard sessions in 14 days — intensity stacking elevated.`);
  } else if (hard14 <= 2 && freshness >= 65) {
    evidence.push("Hard-session density is controlled.");
  }

  if (input.goal.raceDate) {
    const days = Math.ceil(
      (new Date(input.goal.raceDate).getTime() - Date.now()) / 86400000
    );
    if (days > 0 && days <= 14) {
      evidence.push(`${days} days to race — freshness window matters.`);
    }
  }

  let label: FreshnessAssessment["label"] = "neutral";
  if (score >= 68 && timeAdjustmentSec <= 0) label = "fresh";
  else if (score < 42 || timeAdjustmentSec > 40) label = "fatigued";

  return {
    score,
    label,
    timeAdjustmentSec,
    evidence,
    risks,
  };
}
