import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import { archetypeDisplayLabel } from "./archetype";
import { inWindow } from "./aggregates";
import { modalityLabel } from "./modality";
import type { RollingWindowDays, TrainingEcosystemAnalysis } from "./types";

export type EcosystemWindow = RollingWindowDays;

export function parseEcosystemWindow(args?: { window?: number }): EcosystemWindow {
  const w = args?.window ?? 28;
  if (w <= 7) return 7;
  if (w <= 14) return 14;
  if (w <= 28) return 28;
  if (w <= 56) return 56;
  return 84;
}

function eco(analytics: DashboardInsights): TrainingEcosystemAnalysis {
  return analytics.trainingEcosystem;
}

export function getTrainingEcosystemSummary(
  analytics: DashboardInsights,
  window: EcosystemWindow = 28,
) {
  const e = eco(analytics);
  const snap = e.rolling[window];
  return {
    windowDays: window,
    archetype: e.archetype.archetype,
    archetypeLabel: archetypeDisplayLabel(e.archetype.archetype),
    scores: e.scores,
    snapshot: snap ?? null,
    currentWeek: e.currentWeek,
    headline: e.totalContext.headline,
    topInsights: e.ecosystemInsights.slice(0, 6),
    limitations: e.limitations,
    confidence: e.confidence,
  };
}

export function getModalityDistribution(
  analytics: DashboardInsights,
  window: EcosystemWindow = 28,
) {
  const e = eco(analytics);
  const snap = e.rolling[window];
  const dist = snap?.modalityDistribution ?? {};
  return {
    windowDays: window,
    distribution: Object.entries(dist).map(([modality, count]) => ({
      modality,
      label: modalityLabel(modality as import("./types").ActivityModality),
      sessions: count,
      minutes: null,
    })),
    coverage: e.modalityCoverage,
    sportMix: e.totalContext.sportMix,
    evidence: [`${snap?.totalTrainingMinutes ?? 0} total training minutes in window`],
    limitations: e.limitations.slice(0, 2),
  };
}

export function getCrossTrainingSupport(
  analytics: DashboardInsights,
  window: EcosystemWindow = 28,
) {
  const e = eco(analytics);
  const snap = e.rolling[window];
  return {
    windowDays: window,
    aerobicSupportScore: e.scores.aerobicSupport,
    bikeMinutes: snap?.bikeMinutes ?? 0,
    swimMinutes: snap?.swimMinutes ?? 0,
    aerobicCrossTrainingMinutes: snap?.aerobicCrossTrainingMinutes ?? 0,
    signals: e.supportSignals.filter((s) => s.dimension === "aerobic_support"),
    bikeHours28d: e.totalContext.last28Days.bikeHours,
    swimHours28d: e.totalContext.last28Days.swimHours,
    limitations: [
      "Does not convert bike/swim to run-equivalent distance.",
      "Does not adjust race predictions.",
    ],
    confidence: e.confidence,
  };
}

export function getInterferenceRisks(analytics: DashboardInsights, window: EcosystemWindow = 28) {
  const e = eco(analytics);
  const flags = e.interferenceFlags.filter((f) => inWindow(f.nonRunDate, window));
  return {
    windowDays: window,
    interferenceRiskScore: e.scores.interferenceRisk,
    flags: flags.slice(0, 10),
    raceWeekWarnings: e.raceWeekWarnings,
    limitations: ["Language: may interfere / could increase fatigue — not medical certainty."],
    confidence: flags.some((f) => f.severity === "high") ? "medium" : "low",
  };
}

export function getAthleteArchetypePayload(analytics: DashboardInsights) {
  const e = eco(analytics);
  return {
    ...e.archetype,
    displayLabel: archetypeDisplayLabel(e.archetype.archetype),
    modalityCoverage: e.modalityCoverage,
    rolling56: e.rolling[56]?.modalityDistribution,
  };
}

export function compareModalityBlocks(
  analytics: DashboardInsights,
  blockADays = 28,
  blockBDays = 28,
) {
  const e = eco(analytics);
  const now = new Date();
  const blockA = e.activities.filter((a) => {
    const t = new Date(a.startDate).getTime();
    return t >= now.getTime() - blockADays * 86400000;
  });
  const blockB = e.activities.filter((a) => {
    const t = new Date(a.startDate).getTime();
    const end = now.getTime() - blockADays * 86400000;
    return t >= end - blockBDays * 86400000 && t < end;
  });

  const count = (acts: typeof blockA, mod: string) => acts.filter((a) => a.modality === mod).length;

  return {
    blockA: { days: blockADays, sessions: blockA.length, run: count(blockA, "run") },
    blockB: { days: blockBDays, sessions: blockB.length, run: count(blockB, "run") },
    deltas: {
      runSessions: count(blockA, "run") - count(blockB, "run"),
      bike: count(blockA, "bike") - count(blockB, "bike"),
      swim: count(blockA, "swim") - count(blockB, "swim"),
      strength: count(blockA, "strength") - count(blockB, "strength"),
      hiit:
        count(blockA, "high_intensity_cross_training") -
        count(blockB, "high_intensity_cross_training"),
    },
    limitations: ["Block comparison uses session counts, not load models."],
    confidence: blockA.length >= 8 && blockB.length >= 8 ? "medium" : "low",
  };
}

export function getRaceWeekInterferenceCheck(analytics: DashboardInsights, _goalId?: string) {
  const e = eco(analytics);
  return {
    warnings: e.raceWeekWarnings,
    recommendations: [
      "Reduce or maintain strength in race week; avoid new HIIT within 48h of race.",
      "Mobility and easy movement can support taper confidence.",
      "Running remains primary for race-day pacing decisions.",
    ],
    limitations: e.limitations,
    confidence: e.raceWeekWarnings.length > 0 ? "medium" : "low",
  };
}

export function getStrengthMobilitySupport(
  analytics: DashboardInsights,
  window: EcosystemWindow = 14,
) {
  const e = eco(analytics);
  const snap = e.rolling[window];
  return {
    windowDays: window,
    strengthScore: e.scores.strengthSupport,
    mobilityScore: e.scores.mobilitySupport,
    strengthSessions: snap?.strengthSessions ?? 0,
    mobilitySessions: snap?.mobilitySessions ?? 0,
    signals: e.supportSignals.filter(
      (s) => s.dimension === "strength" || s.dimension === "mobility",
    ),
    shouldDoStrengthThisWeek:
      e.scores.strengthSupport >= 50 && e.scores.interferenceRisk < 55
        ? "Maintain 1–2 moderate strength sessions if separated from quality runs."
        : e.scores.interferenceRisk >= 55
          ? "Defer heavy strength until interference risk eases."
          : "Consider 1–2 strength sessions for durability if run load is rising.",
    limitations: ["No set/rep/load from Strava — timing and duration only."],
    confidence: e.confidence,
  };
}

export function buildFullEcosystemCoachPayload(
  analytics: DashboardInsights,
  raceGoal: RaceGoal | null,
) {
  const window = 28;
  return {
    summary: getTrainingEcosystemSummary(analytics, window),
    modality: getModalityDistribution(analytics, window),
    crossTraining: getCrossTrainingSupport(analytics, window),
    interference: getInterferenceRisks(analytics, window),
    archetype: getAthleteArchetypePayload(analytics),
    strengthMobility: getStrengthMobilitySupport(analytics, 14),
    raceWeek: raceGoal ? getRaceWeekInterferenceCheck(analytics) : null,
    coachNotes: [
      "Use sport_type from Strava API as canonical classifier.",
      "Running = performance/readiness/predictions; other modalities = context.",
      "Never invent session counts — use tool payloads only.",
    ],
  };
}
