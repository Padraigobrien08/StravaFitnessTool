import type { RaceForecastInput } from "./forecastTypes";
import type { ExecutionAssessment } from "./forecastTypes";

export function assessExecution(input: RaceForecastInput): ExecutionAssessment {
  const ctx = input.athleteContext ?? {};
  const evidence: string[] = [];
  let score = 62;

  const trend = ctx.efficiencyTrend;
  const easyPct = ctx.easyPct ?? 55;

  if (trend === "improving") {
    score += 14;
    evidence.push("Aerobic efficiency improving at comparable heart rate.");
  } else if (trend === "declining") {
    score -= 12;
    evidence.push("Efficiency softening: execution risk on long efforts.");
  }

  if (easyPct >= 55) {
    score += 8;
    evidence.push("Easy-day share supports sustainable pacing.");
  } else if (easyPct < 40) {
    score -= 10;
    evidence.push("Low easy-day share: positive split / fade risk.");
  }

  const hard14 = ctx.hardRunsLast14d ?? 0;
  if (hard14 >= 5) {
    score -= 8;
    evidence.push("High recent intensity may compromise even pacing.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let fadeRisk: ExecutionAssessment["fadeRisk"] = "medium";
  let pacingRisk: ExecutionAssessment["pacingRisk"] = "medium";
  if (score >= 72) {
    fadeRisk = "low";
    pacingRisk = "low";
  } else if (score < 45) {
    fadeRisk = "high";
    pacingRisk = "high";
  }

  const conservativePaddingSec = fadeRisk === "high" ? 90 : fadeRisk === "medium" ? 45 : 20;

  const recommendation =
    fadeRisk === "high"
      ? "Start conservatively; protect the second half: current patterns suggest late fade."
      : fadeRisk === "low"
        ? "Stable execution patterns support even pacing at projected effort."
        : "Use controlled early pace; monitor drift in the second half.";

  return {
    score,
    fadeRisk,
    pacingRisk,
    evidence,
    recommendation,
    conservativePaddingSec,
  };
}
