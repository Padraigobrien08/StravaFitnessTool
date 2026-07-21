import type { RaceGoal } from "@/lib/analytics/readiness";
import { weekStartKey } from "@/lib/analytics/week";
import {
  aggregateWeek,
  buildRecentWeeks,
  buildRollingSnapshots,
  inWindow,
} from "./aggregates";
import {
  archetypeDisplayLabel,
  detectAthleteArchetype,
  modalityCoverageFromDistribution,
} from "./archetype";
import { buildEcosystemInsightList } from "./insightGenerators";
import { collectInterferenceFlags } from "./interference";
import { computeEcosystemScores } from "./scoring";
import type {
  NormalizedActivity,
  TotalTrainingContext,
  TrainingEcosystemAnalysis,
} from "./types";

export { detectInterference, detectRaceWeekInterference } from "./interference";

function buildTotalContext(
  activities: NormalizedActivity[],
  rolling28: ReturnType<typeof buildRollingSnapshots>[28]
): TotalTrainingContext {
  const last28 = activities.filter((a) => inWindow(a.startDate, 28));
  const runs = last28.filter((a) => a.modality === "run");
  const nonRun = last28.filter((a) => a.modality !== "run");
  const runMin = runs.reduce((s, a) => s + a.movingTimeSec, 0) / 60;
  const crossMin = nonRun.reduce((s, a) => s + a.movingTimeSec, 0) / 60;
  const bikeMin =
    rolling28?.bikeMinutes ??
    last28
      .filter((a) => a.modality === "bike")
      .reduce((s, a) => s + a.movingTimeSec / 60, 0);
  const swimMin =
    rolling28?.swimMinutes ??
    last28
      .filter((a) => a.modality === "swim")
      .reduce((s, a) => s + a.movingTimeSec / 60, 0);

  const mixMap = new Map<string, number>();
  for (const a of last28) {
    mixMap.set(a.sportType, (mixMap.get(a.sportType) ?? 0) + 1);
  }
  const sportMix = [...mixMap.entries()]
    .map(([sportType, count]) => ({
      sportType,
      count,
      modality:
        last28.find((x) => x.sportType === sportType)?.modality ?? "unknown",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const headline =
    nonRun.length === 0
      ? "Modality-aware context needs non-run Strava activities (bike, strength, swim, etc.)."
      : `${runs.length} runs · ${nonRun.length} non-run sessions (28d) — running stays primary for race performance.`;

  return {
    last28Days: {
      runSessions: runs.length,
      nonRunSessions: nonRun.length,
      totalMovingHours: Math.round((runMin + crossMin) / 60 * 10) / 10,
      runMovingHours: Math.round(runMin / 60 * 10) / 10,
      crossTrainingMovingHours: Math.round(crossMin / 60 * 10) / 10,
      bikeHours: Math.round(bikeMin / 60 * 10) / 10,
      swimHours: Math.round(swimMin / 60 * 10) / 10,
      strengthSessions: last28.filter((a) => a.modality === "strength").length,
      mobilitySessions: last28.filter((a) => a.modality === "mobility").length,
    },
    sportMix,
    headline,
  };
}

export function buildTrainingEcosystem(
  activities: NormalizedActivity[],
  raceGoal: RaceGoal | null = null,
  dataConfidence: "low" | "medium" | "high" = "medium"
): TrainingEcosystemAnalysis {
  const interferenceFlags = collectInterferenceFlags(activities, raceGoal);
  const raceWeekWarnings = interferenceFlags.filter((f) => f.kind === "race_week");

  const last28acts = activities.filter((a) => inWindow(a.startDate, 28));
  const runKm28 = last28acts
    .filter((a) => a.modality === "run")
    .reduce((s, a) => s + (a.distanceMeters ?? 0) / 1000, 0);
  const total28 = last28acts.length || 1;
  const runSessionPct = (last28acts.filter((a) => a.modality === "run").length / total28) * 100;
  const nonRun28 = last28acts.filter((a) => a.modality !== "run").length;

  const { scores, supportSignals, fatigueContext } = computeEcosystemScores(
    activities,
    interferenceFlags,
    runKm28,
    runSessionPct,
    nonRun28
  );

  const rolling = buildRollingSnapshots(activities);
  const recentWeeks = buildRecentWeeks(activities, interferenceFlags);
  const currentWeek =
    recentWeeks[recentWeeks.length - 1] ??
    aggregateWeek(activities, weekStartKey(new Date()), interferenceFlags);

  const archetype = detectAthleteArchetype(rolling[56], rolling[84]);
  const modalityCoverage = modalityCoverageFromDistribution(
    rolling[84]?.modalityDistribution ??
      rolling[28]?.modalityDistribution ??
      {}
  );

  for (const f of interferenceFlags.filter((x) => x.severity !== "low").slice(0, 2)) {
    supportSignals.push({
      id: f.id,
      dimension: "context",
      label: f.message.slice(0, 90),
      trend: "warning",
      evidence: f.evidence,
      confidence: f.confidence,
      limitations: ["Inferred from timing and sport_type."],
      directness: "fatigue_context",
    });
  }

  const ecosystemInsights = buildEcosystemInsightList({
    scores,
    supportSignals,
    interferenceFlags,
    activities,
    archetype,
    rolling28: rolling[28],
  });

  const nonRunCount = activities.filter((a) => a.modality !== "run").length;
  let confidence: "low" | "medium" | "high" = dataConfidence;
  if (nonRunCount < 2) confidence = "low";
  else if (nonRunCount >= 6 && confidence !== "low") confidence = "medium";

  const limitations = [
    "Running remains primary for race performance, pacing, and run-specific adaptation.",
    "Other modalities inform fatigue, recovery, durability, and balance — not race predictions.",
    "Intensity inferred from sport_type, duration, HR when present — not power/TSS for all sports.",
    "Strava API sport_type is canonical; legacy type field is not used for classification.",
  ];
  if (nonRunCount === 0) {
    limitations.push("No non-run activities synced — ecosystem insights are limited.");
  }

  const readinessContextNote =
    scores.interferenceRisk >= 60
      ? `Stacked intensity may compress readiness (${archetypeDisplayLabel(archetype.archetype)} profile). Prioritize run freshness before race work.`
      : scores.mobilitySupport >= 60 && scores.strengthSupport >= 55
        ? "Strength and mobility patterns support training sustainability alongside run load."
        : archetype.archetype === "triathlete"
          ? "Bike/swim volume supports aerobic base; run specificity still drives race predictions."
          : null;

  return {
    activities,
    scores,
    archetype,
    currentWeek,
    recentWeeks,
    rolling,
    modalityCoverage,
    totalContext: buildTotalContext(activities, rolling[28]),
    interferenceFlags,
    supportSignals,
    ecosystemInsights,
    raceWeekWarnings,
    readinessContextNote,
    fatigueContextNote: fatigueContext,
    confidence,
    limitations,
  };
}
