import type { DashboardInsights } from "@/lib/analytics";
import { archetypeDisplayLabel } from "@/lib/ecosystem";
import type { CoachingModalityContext } from "./types";

export function buildModalityContext(insights: DashboardInsights): CoachingModalityContext {
  const eco = insights.trainingEcosystem;
  const archetype = eco.archetype.archetype;
  const dist: Record<string, number> = {};
  const modDist =
    eco.rolling[28]?.modalityDistribution ?? eco.currentWeek.modalityDistribution ?? {};
  for (const [k, v] of Object.entries(modDist)) {
    if (v != null) dist[k] = v;
  }

  const ctx = eco.totalContext.last28Days;
  const crossTrainingSummary =
    ctx.nonRunSessions === 0
      ? "No non-run activities in the last 28 days."
      : `${ctx.nonRunSessions} non-run sessions (${ctx.crossTrainingMovingHours}h cross-training, bike ${ctx.bikeHours}h, swim ${ctx.swimHours}h).`;

  const strengthSummary =
    ctx.strengthSessions === 0
      ? "No logged strength work in 28d."
      : `${ctx.strengthSessions} strength session(s) in 28d — support score ${eco.scores.strengthSupport}.`;

  const mobilitySummary =
    ctx.mobilitySessions === 0
      ? "No logged mobility/recovery sessions in 28d."
      : `${ctx.mobilitySessions} mobility/recovery session(s) — mobility support ${eco.scores.mobilitySupport}.`;

  const interferenceRisks = eco.interferenceFlags
    .filter((f) => f.severity !== "low")
    .slice(0, 4)
    .map((f) => f.message);

  return {
    athleteArchetype: archetype,
    modalityDistribution: dist,
    crossTrainingSummary: `${archetypeDisplayLabel(archetype)}. ${crossTrainingSummary}`,
    strengthSummary,
    mobilitySummary,
    interferenceRisks,
  };
}
