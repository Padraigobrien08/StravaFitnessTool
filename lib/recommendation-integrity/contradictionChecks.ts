import type { RecommendationIssue, WeeklyPlanIntegrityInput } from "./types";

function planText(plan: WeeklyPlanIntegrityInput["plan"]): string {
  return [
    plan.summary,
    ...plan.rationale.evidenceUsed,
    ...plan.rationale.tradeoffs,
    ...plan.workouts.map((w) => `${w.purpose} ${w.reasoning}`),
  ].join("\n");
}

export function runContradictionChecks(input: WeeklyPlanIntegrityInput): RecommendationIssue[] {
  const { plan, context, guardrails } = input;
  const issues: RecommendationIssue[] = [];
  const text = planText(plan);

  const stackingRisk =
    context.constraints.avoidIntensityStacking ||
    context.currentState.intensityBalance === "intensity_heavy" ||
    context.risks.some(
      (r) =>
        /stack|density|hard/i.test(r.label) && (r.severity === "medium" || r.severity === "high"),
    );

  const hardRuns = plan.workouts.filter(
    (w) =>
      w.modality === "run" &&
      (w.intensity === "hard" ||
        /\btempo|interval|threshold|quality\b/i.test(`${w.type} ${w.title}`)),
  );

  if (stackingRisk && hardRuns.length > guardrails.maxHardSessions) {
    issues.push({
      type: "contradiction",
      severity: "high",
      message: "Plan adds hard runs while context flags elevated intensity stacking risk",
      suggestedFix: `Cap at ${guardrails.maxHardSessions} hard run(s) and space with easy days`,
    });
  }

  if (
    guardrails.raceWeek &&
    (plan.planType === "build" || plan.totalRunDistanceKm != null) &&
    plan.totalRunDistanceKm != null &&
    plan.totalRunDistanceKm > guardrails.maxWeeklyRunKm * 0.95
  ) {
    issues.push({
      type: "race_week_violation",
      severity: "high",
      message: "Race-week plan volume is too high for taper constraints",
      suggestedFix: "Reduce run volume and prioritise freshness before race",
    });
  }

  if (guardrails.raceWeek && hardRuns.length > 1) {
    issues.push({
      type: "race_week_violation",
      severity: "high",
      message: "Multiple hard runs in race week contradict taper guardrails",
      suggestedFix: "Keep at most one short sharp session or race only",
    });
  }

  const strengthBenefit = /\bstrength\b.*\b(help|benefit|support)/i.test(text);
  const strengthHarm = /\bstrength\b.*\b(interfer|hurt|compromise|fatigue)/i.test(text);
  const strengthBoth =
    strengthBenefit &&
    strengthHarm &&
    !/\bwhen\b|\bif\b|\bdepends\b|\bseparate\b|\b48h\b/i.test(text);

  if (strengthBoth && !/\bwhen\b|\bif\b|\bdepends\b|\bnuance\b/i.test(text)) {
    issues.push({
      type: "contradiction",
      severity: "medium",
      message: "Strength described as both beneficial and interfering without timing nuance",
      suggestedFix:
        "Clarify: light strength supports durability; heavy strength should be separated from key runs",
    });
  }

  const highConfTarget =
    (plan.confidence === "high" || plan.confidence === "medium_high") &&
    (context.dataQuality.hrCoverage === "low" ||
      context.dataQuality.streamCoverage === "low" ||
      context.dataQuality.activityCount < 6);

  if (highConfTarget) {
    issues.push({
      type: "overconfidence",
      severity: "high",
      message: "Plan confidence is high despite limited HR/stream coverage or sparse data",
      suggestedFix: "Lower plan confidence to low or medium and expand limitations",
    });
  }

  if (plan.confidence === "high" && context.currentState.specificity === "low" && context.goal) {
    issues.push({
      type: "overconfidence",
      severity: "medium",
      message: "High-confidence race plan with low training specificity to goal",
      suggestedFix: "Use medium confidence until race-specific work accumulates",
    });
  }

  return issues;
}
