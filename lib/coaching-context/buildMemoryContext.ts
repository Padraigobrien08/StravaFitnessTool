import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import { buildAthleteMemoryProfile, selectRelevantBeliefs } from "@/lib/athlete-memory";
import type { AthletePattern } from "./types";

export function buildMemoryPatterns(
  insights: DashboardInsights,
  raceGoal?: RaceGoal | null,
): AthletePattern[] {
  const profile = buildAthleteMemoryProfile(insights);
  const { beliefs } = selectRelevantBeliefs(profile, {
    goal: raceGoal ?? null,
    maxBeliefs: 6,
  });

  return beliefs.map((b) => ({
    id: b.id,
    label: b.category.charAt(0).toUpperCase() + b.category.slice(1),
    summary: b.statement,
    confidence: b.confidence,
  }));
}

export function buildAthleteMemoryForContext(
  insights: DashboardInsights,
  raceGoal?: RaceGoal | null,
) {
  const profile = buildAthleteMemoryProfile(insights);
  return selectRelevantBeliefs(profile, { goal: raceGoal ?? null, maxBeliefs: 6 });
}

export function buildAthleteProfileSummary(insights: DashboardInsights): string {
  const eco = insights.trainingEcosystem;
  const archetype = eco.archetype;
  const parts = [
    archetype.label,
    eco.totalContext.headline,
    insights.summary.runCount > 0
      ? `${insights.summary.runCount} runs in history; ${insights.summary.last7DaysKm.toFixed(0)} km last 7d.`
      : "Limited run history.",
  ];
  if (insights.dataConfidence !== "high") {
    parts.push(`Data confidence: ${insights.dataConfidence}.`);
  }
  return parts.filter(Boolean).join(" ");
}
