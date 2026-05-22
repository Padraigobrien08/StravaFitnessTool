import type { DashboardInsights } from "@/lib/analytics";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail, FitLap } from "@/lib/strava/fitTypes";
import type { WorkoutClassification, WorkoutType } from "@/lib/analytics/workoutType";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import { formatWorkoutTitle, type FormattedWorkoutTitle } from "./formatWorkoutName";
import {
  formatDistanceKm,
  formatDuration,
  formatKm,
  formatPace,
} from "@/lib/utils";
import { paceSecPerKm } from "@/lib/analytics/pace";
import {
  scoreSessionExecution,
  thirdAvgPace,
} from "@/lib/reasoning/executionScore";
import { parseISO, subDays } from "date-fns";

export type ExecutionGrade = "strong" | "steady" | "mixed" | "limited";

export interface WorkoutHeroView {
  sessionTitle: string;
  formattedTitle: FormattedWorkoutTitle;
  dateDisplay: string;
  summary: string;
  executionGrade: ExecutionGrade;
  executionLabel: string;
  primaryAdaptation: string;
  recommendation: string;
  characteristics: string[];
  workoutType: WorkoutType;
  confidence: "low" | "medium" | "high";
  effortScore: number;
  fatigueImpact: string;
  efficiencyScore: number | null;
  readinessImpact: string;
  inlineMetrics: { label: string; value: string }[];
}

export interface ExecutionInsightView {
  title: string;
  body: string;
  tone: "positive" | "neutral" | "warning";
}

export interface ExecutionAnalysisView {
  qualityScore: number;
  pacingStabilityScore: number;
  fatigueInterpretation: string;
  insights: ExecutionInsightView[];
}

export interface StreamAnnotationView {
  text: string;
  kind: "pace" | "hr" | "general";
}

export interface SegmentRowView {
  index: number;
  distance: string;
  time: string;
  pace: string;
  hr: string;
  role: string;
  roleTone: "work" | "recovery" | "steady" | "neutral";
  highlight: string | null;
  consistencyNote: string | null;
}

export interface AdaptationSignalView {
  title: string;
  evidence: string;
  confidence: "low" | "medium" | "high";
}

export interface HistoricalCompareView {
  text: string;
  tone: "positive" | "neutral";
}

export interface WorkoutDataQualityView {
  interpretationConfidence: "low" | "medium" | "high";
  summary: string;
  hrCoverage: boolean;
  paceCoverage: boolean;
  lapCount: number;
  classificationConfidence: "low" | "medium" | "high";
  gaps: string[];
}

export interface WorkoutDetailView {
  hero: WorkoutHeroView;
  interpretation: string;
  execution: ExecutionAnalysisView;
  streamAnnotations: StreamAnnotationView[];
  segments: SegmentRowView[];
  adaptations: AdaptationSignalView[];
  historical: HistoricalCompareView[];
  quality: WorkoutDataQualityView;
  compactStats: { label: string; value: string }[];
}

const ADAPTATION_BY_TYPE: Record<WorkoutType, string> = {
  easy: "Aerobic base reinforcement",
  recovery: "Recovery and absorption",
  tempo: "Threshold endurance support",
  interval: "VO₂ / speed stimulus",
  long: "Aerobic durability",
  race: "Race-specific performance",
  unknown: "General training load",
};

function paceCv(paces: number[]): number | null {
  if (paces.length < 3) return null;
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  if (mean === 0) return null;
  const variance =
    paces.reduce((s, p) => s + (p - mean) ** 2, 0) / paces.length;
  return Math.sqrt(variance) / mean;
}

function classifyLapRole(
  lap: FitLap,
  index: number,
  total: number,
  medianPace: number
): { role: string; tone: SegmentRowView["roleTone"] } {
  if (index === 0 && total > 3) return { role: "Warm-up", tone: "neutral" };
  if (index === total - 1 && total > 3) return { role: "Cool-down", tone: "neutral" };
  const pace = lap.avgPaceSecPerKm;
  if (pace == null || medianPace <= 0) return { role: "Steady", tone: "steady" };
  if (pace < medianPace * 0.94) return { role: "Work", tone: "work" };
  if (pace > medianPace * 1.08) return { role: "Recovery", tone: "recovery" };
  return { role: "Steady", tone: "steady" };
}

function buildSegments(fit: FitRunDetail | null): SegmentRowView[] {
  if (!fit?.laps.length) return [];
  const laps = fit.laps.filter((l) => l.avgPaceSecPerKm && l.avgPaceSecPerKm > 0);
  const paces = laps
    .map((l) => l.avgPaceSecPerKm!)
    .filter((p) => p > 0);
  const median =
    paces.length > 0
      ? [...paces].sort((a, b) => a - b)[Math.floor(paces.length / 2)]
      : 0;

  const fastestIdx = laps.reduce(
    (best, l, i) =>
      l.avgPaceSecPerKm && (!best || l.avgPaceSecPerKm < best.pace)
        ? { i, pace: l.avgPaceSecPerKm }
        : best,
    null as { i: number; pace: number } | null
  );

  const workPaces = laps
    .map((l, i) => ({ i, p: l.avgPaceSecPerKm }))
    .filter((x) => x.p && x.p < median * 0.98)
    .map((x) => x.p!);

  const fadePct =
    workPaces.length >= 2
      ? ((workPaces.at(-1)! - workPaces[0]) / workPaces[0]) * 100
      : null;

  return fit.laps.map((lap, index) => {
    const { role, tone } = classifyLapRole(lap, index, fit.laps.length, median);
    let highlight: string | null = null;
    if (fastestIdx && index === fastestIdx.i) {
      highlight = "Strongest interval";
    } else if (fadePct != null && fadePct > 4 && index === fit.laps.length - 2) {
      highlight = "Pace fade";
    }

    const cv = paceCv(
      laps.map((l) => l.avgPaceSecPerKm!).filter(Boolean)
    );

    return {
      index: lap.index,
      distance: lap.distanceM ? formatDistanceKm(lap.distanceM) : "—",
      time: lap.timeSec ? formatDuration(lap.timeSec) : "—",
      pace: lap.avgPaceSecPerKm ? formatPace(lap.avgPaceSecPerKm) : "—",
      hr: lap.avgHr != null ? `${lap.avgHr} bpm` : "—",
      role,
      roleTone: tone,
      highlight,
      consistencyNote:
        cv != null && cv < 0.04 && role === "Work"
          ? "Tight pacing"
          : null,
    };
  });
}

function buildExecution(
  run: RunActivity,
  fit: FitRunDetail | null,
  workout: WorkoutClassification
): ExecutionAnalysisView {
  const scored = scoreSessionExecution(run, fit, workout);
  return {
    qualityScore: scored.qualityScore,
    pacingStabilityScore: scored.pacingStabilityScore,
    fatigueInterpretation: scored.fatigueInterpretation,
    insights: scored.insights,
  };
}

function executionGrade(score: number): { grade: ExecutionGrade; label: string } {
  if (score >= 78) return { grade: "strong", label: "Strong" };
  if (score >= 62) return { grade: "steady", label: "Steady" };
  if (score >= 45) return { grade: "mixed", label: "Mixed" };
  return { grade: "limited", label: "Limited data" };
}

function buildStreamAnnotations(
  fit: FitRunDetail | null,
  execution: ExecutionAnalysisView
): StreamAnnotationView[] {
  const notes: StreamAnnotationView[] = [];
  if (fit && fit.hrStream.length > 20) {
    const hr = fit.hrStream;
    const mid = hr[Math.floor(hr.length / 2)];
    notes.push({
      kind: "hr",
      text: `HR profile spans ${Math.round(hr.at(-1)!.elapsedSec / 60)} min — mid-session avg ~${Math.round(mid.hr)} bpm.`,
    });
  }
  if (fit?.hrDriftPct != null) {
    notes.push({
      kind: "hr",
      text:
        fit.hrDriftPct <= 5
          ? "HR stabilized relative to first half — limited cardiac drift."
          : `HR drift +${fit.hrDriftPct}% — expect higher perceived effort late.`,
    });
  }
  if (fit && fit.paceStream.length > 20) {
    const { first, last } = thirdAvgPace(fit.paceStream);
    if (first != null && last != null && last > first + 5) {
      notes.push({
        kind: "pace",
        text: "Pace consistency weakened in the final third of the session.",
      });
    } else if (first != null && last != null) {
      notes.push({
        kind: "pace",
        text: "Pace held steady across the session — good rhythm discipline.",
      });
    }
  }
  if (fit && fit.laps.length >= 4) {
    notes.push({
      kind: "general",
      text: `${fit.laps.length} lap segments detected — use segment table for interval-level review.`,
    });
  }
  execution.insights.slice(0, 1).forEach((i) => {
    notes.push({ kind: "general", text: i.body });
  });
  return notes.slice(0, 5);
}

function buildAdaptations(
  workout: WorkoutClassification,
  run: RunActivity,
  execution: ExecutionAnalysisView
): AdaptationSignalView[] {
  const conf = workout.confidence;
  const items: AdaptationSignalView[] = [
    {
      title: ADAPTATION_BY_TYPE[workout.type],
      evidence: workout.signals[0] ?? `Classified as ${WORKOUT_TYPE_LABELS[workout.type]}.`,
      confidence: conf,
    },
  ];

  if (execution.qualityScore >= 70) {
    items.push({
      title: "Pacing discipline",
      evidence: `Execution score ${execution.qualityScore}/100 — repeatable rhythm supports progression.`,
      confidence: execution.qualityScore >= 80 ? "high" : "medium",
    });
  }

  if (run.trainingLoad != null && run.trainingLoad > 80) {
    items.push({
      title: "Training load stimulus",
      evidence: `Load ${Math.round(run.trainingLoad)} — meaningful stress for fitness adaptation.`,
      confidence: "medium",
    });
  }

  if (workout.type === "long") {
    items.push({
      title: "Aerobic durability",
      evidence: `${formatKm(run.distanceM / 1000)} extends time-on-feet capacity.`,
      confidence: conf,
    });
  }

  return items.slice(0, 4);
}

function comparableRuns(
  run: RunActivity,
  allRuns: RunActivity[],
  workoutType: WorkoutType,
  workoutMap: Map<string, WorkoutClassification>
): RunActivity[] {
  const cutoff = subDays(parseISO(run.date), 56);
  return allRuns.filter(
    (r) =>
      r.id !== run.id &&
      parseISO(r.date) >= cutoff &&
      parseISO(r.date) < parseISO(run.date) &&
      workoutMap.get(r.id)?.type === workoutType
  );
}

function buildHistorical(
  run: RunActivity,
  allRuns: RunActivity[],
  workout: WorkoutClassification,
  workoutMap: Map<string, WorkoutClassification>,
  insights: DashboardInsights | null
): HistoricalCompareView[] {
  const items: HistoricalCompareView[] = [];
  const pace = paceSecPerKm(run);
  const similar = comparableRuns(run, allRuns, workout.type, workoutMap);

  if (insights?.personalRecords.some((pr) => pr.runId === run.id)) {
    items.push({
      text: "This session holds a personal record at standard distance.",
      tone: "positive",
    });
  }

  if (pace && similar.length > 0) {
    const similarPaces = similar
      .map((r) => paceSecPerKm(r))
      .filter((p): p is number => p != null);
    if (similarPaces.length > 0) {
      const best = Math.min(...similarPaces);
      if (pace <= best + 3) {
        items.push({
          text: `Fastest ${WORKOUT_TYPE_LABELS[workout.type].toLowerCase()} session in the last 8 weeks.`,
          tone: "positive",
        });
      }
      const avgHrSimilar = similar.filter((r) => r.avgHr != null);
      if (run.avgHr && avgHrSimilar.length >= 2) {
        const avg =
          avgHrSimilar.reduce((s, r) => s + (r.avgHr ?? 0), 0) /
          avgHrSimilar.length;
        if (run.avgHr < avg - 3) {
          items.push({
            text: "Lower average HR than prior comparable sessions — improved efficiency.",
            tone: "positive",
          });
        }
      }
    }
  }

  if (items.length === 0 && similar.length > 0) {
    items.push({
      text: `${similar.length} similar ${WORKOUT_TYPE_LABELS[workout.type].toLowerCase()} sessions in the prior 8 weeks for context.`,
      tone: "neutral",
    });
  }

  if (items.length === 0) {
    items.push({
      text: "Build more same-type sessions to unlock comparison insights.",
      tone: "neutral",
    });
  }

  return items.slice(0, 4);
}

export function buildWorkoutDetailView(
  run: RunActivity,
  workout: WorkoutClassification,
  fit: FitRunDetail | null,
  allRuns: RunActivity[],
  insights: DashboardInsights | null
): WorkoutDetailView {
  const formattedTitle = formatWorkoutTitle(run.name);
  const execution = buildExecution(run, fit, workout);
  const grade = executionGrade(execution.qualityScore);
  const pace = paceSecPerKm(run);
  const efficiency =
    pace && run.avgHr && run.avgHr > 0
      ? Math.round((pace / run.avgHr) * 1000) / 1000
      : null;

  const workoutMap = insights
    ? new Map(
        insights.workoutLabels.map((l) => [l.runId, l.classification])
      )
    : new Map<string, WorkoutClassification>();

  const characteristics: string[] = [];
  if (run.trainingLoad != null && run.trainingLoad > 60) {
    characteristics.push("Elevated training load");
  } else if (workout.type === "easy" || workout.type === "recovery") {
    characteristics.push("Low stress / absorption focus");
  }
  if (fit?.hrDriftPct != null && fit.hrDriftPct <= 5) {
    characteristics.push("Controlled cardiac drift");
  }
  if (execution.pacingStabilityScore >= 70) {
    characteristics.push("Stable pacing rhythm");
  }
  if (characteristics.length === 0) {
    characteristics.push(`${WORKOUT_TYPE_LABELS[workout.type]} stimulus`);
  }

  const sessionTitle =
    workout.type === "interval"
      ? "Interval session"
      : workout.type === "tempo"
        ? "Threshold session"
        : workout.type === "long"
          ? "Long aerobic session"
          : `${WORKOUT_TYPE_LABELS[workout.type]} session`;

  const summary =
    execution.insights[0]?.body ??
    `${WORKOUT_TYPE_LABELS[workout.type]} work — ${formatDistanceKm(run.distanceM)} in ${formatDuration(run.movingSec || run.elapsedSec)}.`;

  const hero: WorkoutHeroView = {
    sessionTitle,
    formattedTitle,
    dateDisplay: new Date(run.date).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    }),
    summary,
    executionGrade: grade.grade,
    executionLabel: grade.label,
    primaryAdaptation: ADAPTATION_BY_TYPE[workout.type],
    recommendation:
      grade.grade === "strong"
        ? "Absorb with easy running — you executed well; avoid stacking intensity too soon."
        : grade.grade === "mixed" || execution.qualityScore < 50
          ? "Consider extra recovery — execution signals accumulated fatigue."
          : "Review segment table and streams — refine pacing or recovery between reps.",
    characteristics,
    workoutType: workout.type,
    confidence: workout.confidence,
    effortScore: (() => {
      const maxHr = insights?.athleteMaxHr ?? 190;
      if (run.avgHr && maxHr > 0) {
        return Math.min(100, Math.round((run.avgHr / maxHr) * 100));
      }
      return workout.type === "easy" || workout.type === "recovery" ? 55 : 68;
    })(),
    fatigueImpact:
      fit?.hrDriftPct != null && fit.hrDriftPct > 6
        ? "Moderate–high"
        : workout.type === "recovery"
          ? "Low"
          : "Moderate",
    efficiencyScore: efficiency,
    readinessImpact: ["interval", "tempo", "race"].includes(workout.type)
      ? "Requires 24–48h easy running"
      : "Supports next-day aerobic work",
    inlineMetrics: [
      { label: "Distance", value: formatDistanceKm(run.distanceM) },
      {
        label: "Time",
        value: formatDuration(run.movingSec || run.elapsedSec),
      },
      { label: "Pace", value: pace ? formatPace(pace) : "—" },
      { label: "Avg HR", value: run.avgHr ? `${run.avgHr} bpm` : "—" },
    ],
  };

  const interpretation = [
    `This was a ${WORKOUT_TYPE_LABELS[workout.type].toLowerCase()} session.`,
    execution.fatigueInterpretation,
    workout.signals.length > 0 ? workout.signals[0] : null,
  ]
    .filter(Boolean)
    .join(" ");

  const hasHr = (fit?.hrStream.length ?? 0) > 10 || run.avgHr != null;
  const hasPace = (fit?.paceStream.length ?? 0) > 10 || pace != null;
  const streamConf =
    hasHr && hasPace && (fit?.laps.length ?? 0) >= 3
      ? "high"
      : hasHr || hasPace
        ? "medium"
        : "low";

  return {
    hero,
    interpretation,
    execution,
    streamAnnotations: buildStreamAnnotations(fit, execution),
    segments: buildSegments(fit),
    adaptations: buildAdaptations(workout, run, execution),
    historical: buildHistorical(run, allRuns, workout, workoutMap, insights),
    quality: {
      interpretationConfidence: streamConf,
      summary:
        streamConf === "high"
          ? "Strong HR and pace streams support lap-level interpretation."
          : streamConf === "medium"
            ? "Partial streams — summary metrics reliable; segment detail may be limited."
            : "Sparse stream data — rely on summary metrics and classification signals.",
      hrCoverage: hasHr,
      paceCoverage: hasPace,
      lapCount: fit?.laps.length ?? 0,
      classificationConfidence: workout.confidence,
      gaps: [
        ...(hasHr ? [] : ["Heart rate stream or avg HR"]),
        ...(hasPace ? [] : ["Pace stream"]),
        ...((fit?.laps.length ?? 0) >= 2 ? [] : ["Lap segmentation"]),
      ],
    },
    compactStats: [
      {
        label: "Elevation",
        value: run.elevationGainM
          ? `+${Math.round(run.elevationGainM)} m`
          : "—",
      },
      {
        label: "Load",
        value: run.trainingLoad != null ? String(Math.round(run.trainingLoad)) : "—",
      },
      {
        label: "Cadence",
        value: run.avgCadence
          ? `${run.avgCadence} spm`
          : fit?.avgCadence
            ? `${fit.avgCadence} spm`
            : "—",
      },
      {
        label: "Weather",
        value: run.weatherTempC != null ? `${run.weatherTempC}°C` : "—",
      },
    ],
  };
}
