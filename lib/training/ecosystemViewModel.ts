import type { DashboardInsights } from "@/lib/analytics";
import { archetypeDisplayLabel, modalityLabel } from "@/lib/ecosystem";
import { sportTypeLabel } from "@/lib/ecosystem/modality";
import type { ActivityModality, TrainingEcosystemAnalysis } from "@/lib/ecosystem/types";

export interface ModalityDistributionRow {
  modality: ActivityModality;
  label: string;
  sessions: number;
  minutes: number;
}

export interface SupportCardView {
  id: string;
  title: string;
  score: number;
  trend: "positive" | "neutral" | "warning";
  detail: string;
  evidence: string[];
  confidence: "low" | "medium" | "high";
  limitations: string[];
}

export interface InterferenceWarningView {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
  evidence: string[];
}

export interface CrossTrainingLoadView {
  weekLabel: string;
  runKm: string;
  runSessions: number;
  bikeMinutes: number;
  swimMinutes: number;
  crossTrainingMinutes: number;
  strengthSessions: number;
  mobilitySessions: number;
  hiitSessions: number;
  headline: string;
}

export interface TrainingEcosystemView {
  headline: string | null;
  archetypeLabel: string;
  archetypeConfidence: "low" | "medium" | "high";
  modalityDistribution: ModalityDistributionRow[];
  crossTrainingLoad: CrossTrainingLoadView;
  supportCards: SupportCardView[];
  interferenceWarnings: InterferenceWarningView[];
  readinessContext: string | null;
  fatigueContext: string | null;
  confidence: "low" | "medium" | "high";
  limitations: string[];
  hasNonRunData: boolean;
}

function scoreTrend(score: number): "positive" | "neutral" | "warning" {
  if (score >= 65) return "positive";
  if (score >= 40) return "neutral";
  return "warning";
}

function buildModalityRows(eco: TrainingEcosystemAnalysis): ModalityDistributionRow[] {
  const dist = eco.currentWeek.modalityDistribution ?? {};
  const w = eco.currentWeek;
  const minutesByMod: Partial<Record<ActivityModality, number>> = {
    run: w.runMinutes,
    bike: w.bikeMinutes,
    swim: w.swimMinutes,
    aerobic_cross_training: w.aerobicCrossTrainingMinutes,
  };
  return (Object.entries(dist) as [ActivityModality, number][])
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([modality, sessions]) => ({
      modality,
      label: modalityLabel(modality),
      sessions,
      minutes: minutesByMod[modality] ?? 0,
    }));
}

export function buildTrainingEcosystemView(analytics: DashboardInsights): TrainingEcosystemView {
  const eco = analytics.trainingEcosystem;
  const w = eco.currentWeek;
  const ctx = eco.totalContext.last28Days;

  const supportCards: SupportCardView[] = [
    {
      id: "aerobic",
      title: "Aerobic support",
      score: eco.scores.aerobicSupport,
      trend: scoreTrend(eco.scores.aerobicSupport),
      detail: `Bike ${ctx.bikeHours}h · swim ${ctx.swimHours}h (28d)`,
      evidence: eco.supportSignals
        .filter((s) => s.dimension === "aerobic_support")
        .flatMap((s) => s.evidence)
        .slice(0, 3),
      confidence: eco.confidence,
      limitations: eco.limitations.slice(0, 2),
    },
    {
      id: "strength",
      title: "Strength support",
      score: eco.scores.strengthSupport,
      trend: scoreTrend(eco.scores.strengthSupport),
      detail: `${ctx.strengthSessions} strength sessions (28d)`,
      evidence: eco.supportSignals
        .filter((s) => s.dimension === "strength")
        .flatMap((s) => s.evidence)
        .slice(0, 3),
      confidence: eco.confidence,
      limitations: ["Duration-based, not sets/reps from Strava."],
    },
    {
      id: "mobility",
      title: "Mobility support",
      score: eco.scores.mobilitySupport,
      trend: scoreTrend(eco.scores.mobilitySupport),
      detail: `${ctx.mobilitySessions} mobility sessions (28d)`,
      evidence: eco.supportSignals
        .filter((s) => s.dimension === "mobility")
        .flatMap((s) => s.evidence)
        .slice(0, 3),
      confidence: eco.confidence,
      limitations: ["Yoga, pilates, PT, walks when logged."],
    },
    {
      id: "recovery",
      title: "Recovery behavior",
      score: eco.scores.recoveryBehavior,
      trend: scoreTrend(eco.scores.recoveryBehavior),
      detail: "Easy movement after hard runs",
      evidence: eco.supportSignals
        .filter((s) => s.dimension === "recovery_behavior")
        .flatMap((s) => s.evidence)
        .slice(0, 3),
      confidence: eco.confidence,
      limitations: ["Timing + sport_type only."],
    },
  ];

  const interferenceWarnings: InterferenceWarningView[] = eco.interferenceFlags
    .filter((f) => f.severity !== "low")
    .slice(0, 4)
    .map((f) => ({
      id: f.id,
      severity: f.severity,
      title: `${sportTypeLabel(f.nonRunSportType)} · ${f.kind.replace(/_/g, " ")}`,
      message: f.message,
      evidence: f.evidence,
    }));

  const topInsight = eco.ecosystemInsights.find((i) => i.severity === "warning");
  const headline =
    interferenceWarnings.length > 0
      ? interferenceWarnings[0].message
      : (topInsight?.title ?? eco.totalContext.headline);

  return {
    headline: ctx.nonRunSessions > 0 ? headline : null,
    archetypeLabel: archetypeDisplayLabel(eco.archetype.archetype),
    archetypeConfidence: eco.archetype.confidence,
    modalityDistribution: buildModalityRows(eco),
    crossTrainingLoad: {
      weekLabel: w.label,
      runKm: `${w.runDistanceKm} km`,
      runSessions: w.runCount,
      bikeMinutes: w.bikeMinutes,
      swimMinutes: w.swimMinutes,
      crossTrainingMinutes: w.bikeMinutes + w.swimMinutes + w.aerobicCrossTrainingMinutes,
      strengthSessions: w.strengthSessions,
      mobilitySessions: w.mobilitySessions,
      hiitSessions: w.hiitSessions + w.sportSessions,
      headline: eco.totalContext.headline,
    },
    supportCards,
    interferenceWarnings,
    readinessContext: eco.readinessContextNote,
    fatigueContext: eco.fatigueContextNote,
    confidence: eco.confidence,
    limitations: eco.limitations,
    hasNonRunData: ctx.nonRunSessions > 0,
  };
}

export interface ReportEcosystemView {
  runVolumeKm: string;
  bikeHours: string;
  swimHours: string;
  crossTrainingHours: string;
  strengthSessions: number;
  mobilitySessions: number;
  interferenceCount: number;
  archetypeLabel: string;
  supportHighlights: string[];
  limitations: string[];
  sportMix: { label: string; count: number }[];
}

export function buildReportEcosystemView(analytics: DashboardInsights): ReportEcosystemView {
  const eco = analytics.trainingEcosystem;
  const ctx = eco.totalContext.last28Days;
  const r28 = eco.rolling[28];
  return {
    runVolumeKm: `${Math.round(r28?.runDistanceKm ?? 0)} km (28d)`,
    bikeHours: `${ctx.bikeHours}h`,
    swimHours: `${ctx.swimHours}h`,
    crossTrainingHours: `${ctx.crossTrainingMovingHours}h`,
    strengthSessions: ctx.strengthSessions,
    mobilitySessions: ctx.mobilitySessions,
    interferenceCount: eco.interferenceFlags.filter((f) => f.severity !== "low").length,
    archetypeLabel: archetypeDisplayLabel(eco.archetype.archetype),
    supportHighlights: eco.ecosystemInsights
      .filter((i) => i.severity === "positive")
      .map((i) => i.title)
      .slice(0, 4),
    limitations: eco.limitations,
    sportMix: eco.totalContext.sportMix.map((s) => ({
      label: `${modalityLabel(s.modality)} · ${sportTypeLabel(s.sportType)}`,
      count: s.count,
    })),
  };
}
