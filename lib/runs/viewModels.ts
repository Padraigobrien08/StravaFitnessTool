import type { DashboardInsights } from "@/lib/analytics";
import type { PersonalRecord } from "@/lib/analytics/records";
import type { RunActivity } from "@/lib/strava/types";
import type {
  WorkoutClassification,
  WorkoutType,
  RunWorkoutLabel,
} from "@/lib/analytics/workoutType";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import { formatWorkoutTitle, type FormattedWorkoutTitle } from "./formatWorkoutName";
import { formatDistanceKm, formatKm, formatPace } from "@/lib/utils";
import { paceSecPerKm } from "@/lib/analytics/pace";
import { format, parseISO, subDays } from "date-fns";
import { monthKeyFromDate, monthLabelFromKey } from "./explorerUtils";

export type SignificanceLevel = "critical" | "meaningful" | "supporting";

export interface ActivityStateSummaryView {
  headline: string;
  bullets: string[];
}

export interface TrainingStateCardView {
  readiness: string;
  consistency: string;
  easyShare: string;
  frequency: string;
  volumeTrend: string;
  phase: string;
}

export type RunMarker = "pr" | "long" | "key" | "high_load" | "efficient";

export interface RunsHeroView {
  title: string;
  trainingIdentity: string;
  signals: string[];
  recentBehavior: string;
  trainingEmphasis: string;
  stateCard: TrainingStateCardView;
  runCount: number;
  totalKm: string;
  confidence: "low" | "medium" | "high";
}

export interface DistributionWidget {
  label: string;
  value: string;
  hint?: string;
}

export interface WorkoutMixBar {
  type: WorkoutType;
  label: string;
  pct: number;
  runCount: number;
}

export interface TrainingDistributionView {
  mix: WorkoutMixBar[];
  modalityLine: string;
  intensityLine: string;
  frequencyLine: string;
  longRunRhythm: string;
  intervalDensity: string;
  consistencyLine: string;
}

export interface NotableSessionView {
  id: string;
  runId: string;
  title: string;
  meta: string;
  why: string;
  adaptation: string;
  goalRelation: string;
  significance: SignificanceLevel;
  rank: number;
  href: string;
}

export interface RunExplorerRow {
  runId: string;
  date: string;
  dateDisplay: string;
  formattedTitle: FormattedWorkoutTitle;
  rawName: string;
  workout: WorkoutClassification;
  purpose: string;
  impact: string;
  markers: RunMarker[];
  distanceDisplay: string;
  distanceKm: number;
  paceDisplay: string;
  paceSec: number;
  hrDisplay: string;
  loadDisplay: string | null;
  loadValue: number | null;
  hasFit: boolean;
  significanceScore: number;
  significanceTier: SignificanceLevel | "routine";
  executionLabel: string;
  executionRank: number;
  adaptationTags: string[];
  groupKey: string;
  groupLabel: string;
}

export interface PatternInsightView {
  id: string;
  title: string;
  body: string;
  tone: "positive" | "neutral" | "warning";
  coachQuery: string;
}

export interface HistoricalContextView {
  items: { label: string; value: string; detail?: string }[];
}

export interface RunsDataQualityView {
  hrCoveragePct: number;
  fitCount: number;
  classificationNote: string;
  confidenceByType: { type: string; level: string }[];
  warnings: string[];
}

export interface RunsPageView {
  activityState: ActivityStateSummaryView;
  hero: RunsHeroView;
  distribution: TrainingDistributionView;
  notableSessions: NotableSessionView[];
  patterns: PatternInsightView[];
  historical: HistoricalContextView;
  quality: RunsDataQualityView;
  explorerRows: RunExplorerRow[];
  intelligenceSessions: NotableSessionView[];
}

const SESSION_PURPOSE: Record<WorkoutType, string> = {
  easy: "Aerobic base",
  recovery: "Low-load adaptation",
  tempo: "Threshold support",
  interval: "VO₂ / speed stimulus",
  long: "Aerobic endurance",
  race: "Race execution",
  unknown: "Unclassified effort",
};

const SESSION_IMPACT: Record<WorkoutType, string> = {
  easy: "Volume without strain",
  recovery: "Absorb prior load",
  tempo: "Lactate tolerance",
  interval: "Top-end development",
  long: "Endurance extension",
  race: "Performance benchmark",
  unknown: "Review classification",
};

function prBuckets(prs: PersonalRecord[]): Map<string, PersonalRecord> {
  return new Map(prs.map((p) => [p.runId, p]));
}

function recentRuns(runs: RunActivity[], days = 56): RunActivity[] {
  const cutoff = subDays(new Date(), days);
  return runs.filter((r) => parseISO(r.date) >= cutoff);
}

function roundPct(n: number): number {
  return Math.round(n);
}

function significanceScoreFromMarkers(
  markers: RunMarker[],
  workout: WorkoutClassification,
): number {
  let score = 10;
  if (markers.includes("pr")) score = 100;
  else if (markers.includes("efficient") && markers.includes("key")) score = 85;
  else if (markers.includes("long")) score = 75;
  else if (markers.includes("key")) score = 65;
  else if (markers.includes("high_load")) score = 55;
  else if (workout.type === "tempo" || workout.type === "interval") score = 45;
  else if (workout.type === "race") score = 70;
  return score;
}

function tierFromScore(score: number): SignificanceLevel | "routine" {
  if (score >= 80) return "critical";
  if (score >= 55) return "meaningful";
  if (score >= 35) return "supporting";
  return "routine";
}

function executionFromMarkers(
  markers: RunMarker[],
  workout: WorkoutClassification,
): { label: string; rank: number } {
  if (markers.includes("pr") || markers.includes("efficient")) {
    return { label: "Excellent", rank: 4 };
  }
  if (workout.type === "easy" && !markers.includes("high_load")) {
    return { label: "Strong", rank: 3 };
  }
  if (markers.includes("high_load")) {
    return { label: "Elevated cost", rank: 2 };
  }
  if (workout.type === "tempo" || workout.type === "interval") {
    return { label: "Strong", rank: 3 };
  }
  return { label: "Moderate", rank: 2 };
}

function adaptationTagsFor(workout: WorkoutClassification, markers: RunMarker[]): string[] {
  const tags: string[] = [];
  if (markers.includes("pr")) tags.push("Speed");
  if (markers.includes("efficient")) tags.push("Aerobic efficiency");
  if (markers.includes("long")) tags.push("Durability");
  if (workout.type === "tempo") tags.push("Threshold");
  if (workout.type === "interval") tags.push("VO₂");
  if (workout.type === "race") tags.push("Race execution");
  if (markers.includes("high_load")) tags.push("Fatigue load");
  if (tags.length === 0) tags.push("Base volume");
  return tags;
}

function buildMarkers(
  run: RunActivity,
  workout: WorkoutClassification,
  prByRun: Map<string, PersonalRecord>,
  maxLoad: number,
  maxDist56: number,
  efficientRunIds: Set<string>,
): RunMarker[] {
  const markers: RunMarker[] = [];
  if (prByRun.has(run.id)) markers.push("pr");
  const km = run.distanceM / 1000;
  if (km >= maxDist56 * 0.92 && km >= 14) markers.push("long");
  if (
    workout.type === "interval" ||
    workout.type === "tempo" ||
    workout.type === "race" ||
    workout.type === "long"
  ) {
    markers.push("key");
  }
  const load = run.trainingLoad ?? km * 10;
  if (load >= maxLoad * 0.9) markers.push("high_load");
  if (efficientRunIds.has(run.id)) markers.push("efficient");
  return [...new Set(markers)];
}

function buildNotableSessions(
  runs: RunActivity[],
  analytics: DashboardInsights,
  workoutMap: Map<string, WorkoutClassification>,
  _prByRun: Map<string, PersonalRecord>,
): NotableSessionView[] {
  const sessions: NotableSessionView[] = [];
  const sorted = [...runs].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  const goalHint = analytics.raceReadiness
    ? `${analytics.raceReadiness.distanceLabel} prep`
    : "current fitness block";

  for (const pr of analytics.personalRecords.filter((p) =>
    ["5k", "10k", "hm"].includes(p.bucket),
  )) {
    sessions.push({
      id: `pr-${pr.bucket}`,
      runId: pr.runId,
      title: `New ${pr.label} PR`,
      meta: formatPace(pr.paceSecPerKm),
      why: "Top-end speed proof in recent training.",
      adaptation: "Supports top-end speed progression.",
      goalRelation: `Relevant to ${goalHint}.`,
      significance: "critical",
      rank: 100,
      href: `/runs/${pr.runId}`,
    });
  }

  const effPoints = analytics.efficiencyTrend.filter((e) => e.efficiency > 0);
  if (effPoints.length > 0) {
    const best = [...effPoints].sort((a, b) => a.efficiency - b.efficiency)[0];
    const effRun =
      runs.find((r) => r.name === best.runName) ??
      runs.find((r) => r.date.startsWith(best.date.slice(0, 10)));
    sessions.push({
      id: "eff",
      runId: effRun?.id ?? "",
      title: "Strongest aerobic efficiency",
      meta: best.label,
      why: "Fastest pace relative to HR in the recent block.",
      adaptation: "Aerobic efficiency signal — durable fitness.",
      goalRelation: "Protect with easy volume between quality days.",
      significance: "critical",
      rank: 90,
      href: effRun ? `/runs/${effRun.id}` : "/performance",
    });
  }

  const longest = [...sorted].sort((a, b) => b.distanceM - a.distanceM)[0];
  if (longest && longest.distanceM / 1000 >= 12) {
    sessions.push({
      id: "longest",
      runId: longest.id,
      title: "Longest recent run",
      meta: formatDistanceKm(longest.distanceM),
      why: "Primary endurance anchor in the current window.",
      adaptation: "Supports HM durability and long-race confidence.",
      goalRelation: `Key for ${goalHint}.`,
      significance: "meaningful",
      rank: 75,
      href: `/runs/${longest.id}`,
    });
  }

  const hardRecent = sorted.find((r) => {
    const w = workoutMap.get(r.id);
    return w?.type === "tempo" || w?.type === "interval";
  });
  if (hardRecent) {
    sessions.push({
      id: "threshold",
      runId: hardRecent.id,
      title: "Key threshold session",
      meta: WORKOUT_TYPE_LABELS[workoutMap.get(hardRecent.id)!.type],
      why: "High-quality lactate-support stimulus.",
      adaptation: "Threshold tolerance and race-pace support.",
      goalRelation: "Monitor freshness before the next quality day.",
      significance: "meaningful",
      rank: 65,
      href: `/runs/${hardRecent.id}`,
    });
  }

  const byLoad = [...sorted]
    .map((r) => ({
      r,
      load: r.trainingLoad ?? (r.distanceM / 1000) * 10,
    }))
    .sort((a, b) => b.load - a.load)[0];
  if (byLoad && !sessions.some((s) => s.runId === byLoad.r.id)) {
    sessions.push({
      id: "load",
      runId: byLoad.r.id,
      title: "Highest fatigue-cost session",
      meta: workoutMap.get(byLoad.r.id)
        ? WORKOUT_TYPE_LABELS[workoutMap.get(byLoad.r.id)!.type]
        : "—",
      why: "Largest training stress recently — recovery timing matters.",
      adaptation: "Fatigue accumulation — space easy days after.",
      goalRelation: "Watch stacking into the next hard session.",
      significance: "supporting",
      rank: 50,
      href: `/runs/${byLoad.r.id}`,
    });
  }

  return [...sessions].sort((a, b) => b.rank - a.rank).slice(0, 6);
}

function buildPatterns(
  analytics: DashboardInsights,
  labels: RunWorkoutLabel[],
): PatternInsightView[] {
  const patterns: PatternInsightView[] = [];
  const mix = analytics.workoutTypeMix;
  const top = [...mix].sort((a, b) => b.runCount - a.runCount)[0];
  const hardPct =
    mix
      .filter((m) => ["tempo", "interval", "race"].includes(m.type))
      .reduce((s, m) => s + m.pct, 0) ?? 0;

  if (top && top.pct >= 35) {
    patterns.push({
      id: "mix-lean",
      title: `${top.label}-heavy block`,
      body: `${roundPct(top.pct)}% of recent sessions are ${top.label.toLowerCase()} — this defines your current training identity.`,
      tone: top.type === "easy" || top.type === "recovery" ? "positive" : "neutral",
      coachQuery: `Why is my training ${top.label.toLowerCase()}-heavy right now?`,
    });
  }

  if (hardPct >= 30) {
    patterns.push({
      id: "threshold-density",
      title: "Threshold density elevated",
      body: `${roundPct(hardPct)}% quality share — monitor freshness between hard sessions.`,
      tone: "warning",
      coachQuery: "Is my threshold density too high for my current freshness?",
    });
  } else if (analytics.intensityAdvice.currentEasyPct >= 75) {
    patterns.push({
      id: "polarized",
      title: "Aerobic-base rhythm",
      body: `${roundPct(analytics.intensityAdvice.currentEasyPct)}% easy running — supports durable aerobic development.`,
      tone: "positive",
      coachQuery: "Is my easy-volume base appropriate for my goal?",
    });
  }

  if (analytics.efficiencySummary.trend === "improving") {
    patterns.push({
      id: "pace-stability",
      title: "Pace stability improving",
      body: "Execution consistency is improving — faster paces at similar heart rates.",
      tone: "positive",
      coachQuery: "What drove my improving aerobic efficiency?",
    });
  }

  const longCount = mix.find((m) => m.type === "long")?.runCount ?? 0;
  if (longCount === 0 && analytics.summary.runCount >= 15) {
    patterns.push({
      id: "long-gap",
      title: "Long-run gap emerging",
      body: "No 18+ km long run recently — durability may need an aerobic anchor.",
      tone: "warning",
      coachQuery: "Should I schedule a long run this week?",
    });
  }

  const intervalCount = mix.find((m) => m.type === "interval")?.runCount ?? 0;
  if (intervalCount >= 2) {
    patterns.push({
      id: "interval-regular",
      title: "Regular interval stimulus",
      body: `${intervalCount} interval sessions in the window — top-end speed is being trained.`,
      tone: "neutral",
      coachQuery: "Are my intervals spaced correctly for recovery?",
    });
  }

  if (patterns.length === 0) {
    patterns.push({
      id: "establishing",
      title: "Establishing training rhythm",
      body: `${labels.length} classified sessions — patterns sharpen as HR and stream coverage grow.`,
      tone: "neutral",
      coachQuery: "What patterns are emerging in my training?",
    });
  }

  return patterns.slice(0, 5);
}

function buildHistorical(analytics: DashboardInsights): HistoricalContextView {
  const items: HistoricalContextView["items"] = [];

  if (analytics.bestBlock) {
    items.push({
      label: "Strongest block",
      value: `${analytics.bestBlock.label} · ${formatKm(analytics.bestBlock.distanceKm)}`,
      detail: "Highest sustained volume phase in your history sample.",
    });
  }

  const months = analytics.monthlyVolume;
  if (months.length > 0) {
    const best = [...months].sort((a, b) => b.distanceKm - a.distanceKm)[0];
    items.push({
      label: "Highest volume month",
      value: `${best.label} · ${formatKm(best.distanceKm)}`,
      detail: "Peak monthly load for comparison to current week.",
    });
  }

  items.push({
    label: "Longest consistency streak",
    value: `${analytics.consistencyScore.streakWeeks} week${analytics.consistencyScore.streakWeeks === 1 ? "" : "s"}`,
    detail:
      analytics.consistencyScore.streakWeeks >= 4
        ? "Rhythm has been durable across phases."
        : "Building weekly habit strength.",
  });

  if (analytics.efficiencySummary.trend === "improving") {
    items.push({
      label: "Best adaptation phase",
      value: "Efficiency strongest during stable threshold exposure",
      detail: analytics.efficiencyMoM.narrative?.slice(0, 100),
    });
  }

  const r = analytics.raceReadiness;
  if (r && r.daysUntilRace <= 21) {
    items.push({
      label: "Taper context",
      value: `Race in ${r.daysUntilRace}d · ${r.label}`,
      detail: "Compare current sessions to prior successful tapers.",
    });
  }

  return { items };
}

function classificationConfidenceNote(labels: RunWorkoutLabel[]): {
  note: string;
  byType: { type: string; level: string }[];
} {
  const recent = labels.slice(-40);
  const high = recent.filter((l) => l.classification.confidence === "high").length;
  const ratio = recent.length > 0 ? high / recent.length : 0;

  const byTypeMap = new Map<WorkoutType, { high: number; total: number }>();
  for (const l of recent) {
    const t = l.classification.type;
    const cur = byTypeMap.get(t) ?? { high: 0, total: 0 };
    cur.total += 1;
    if (l.classification.confidence === "high") cur.high += 1;
    byTypeMap.set(t, cur);
  }

  const byType = [...byTypeMap.entries()]
    .filter(([, v]) => v.total >= 2)
    .map(([type, v]) => ({
      type: WORKOUT_TYPE_LABELS[type],
      level: v.high / v.total >= 0.6 ? "High" : v.high / v.total >= 0.35 ? "Medium" : "Low",
    }))
    .slice(0, 4);

  const note =
    ratio >= 0.5
      ? "High for interval and distance-anchored sessions; medium for tempo/recovery without HR."
      : "Medium overall — add HR and FIT lap data to sharpen tempo vs easy distinction.";

  return { note, byType };
}

export function buildRunsPageView(
  runs: RunActivity[],
  analytics: DashboardInsights,
  fitRunIds: string[],
  quality: ImportQualityReport | null,
): RunsPageView {
  const workoutMap = new Map(analytics.workoutLabels.map((l) => [l.runId, l.classification]));
  const prByRun = prBuckets(analytics.personalRecords);
  const recent = recentRuns(runs);
  const recentLabels = analytics.workoutLabels.filter((l) => recent.some((r) => r.id === l.runId));

  const totalKm = runs.reduce((s, r) => s + r.distanceM, 0) / 1000;

  const topMix = [...analytics.workoutTypeMix].sort((a, b) => b.runCount - a.runCount)[0];

  const hardPct = analytics.workoutTypeMix
    .filter((m) => ["tempo", "interval", "race"].includes(m.type))
    .reduce((s, m) => s + m.pct, 0);

  let trainingIdentity = "Balanced mixed training identity";
  if (hardPct >= 30 && topMix?.type === "tempo") {
    trainingIdentity = "Threshold-heavy aerobic build with improving efficiency";
  } else if (hardPct >= 30) {
    trainingIdentity = "Quality-dense block with elevated threshold share";
  } else if (analytics.intensityAdvice.currentEasyPct >= 78) {
    trainingIdentity = "Aerobic-base rhythm with selective quality";
  }

  const signals: string[] = [];
  if (topMix && topMix.pct >= 40) {
    signals.push(`${topMix.label} dominant`);
  }
  if (analytics.consistencyScore.streakWeeks >= 3) {
    signals.push("Consistent weekly rhythm");
  }
  const longRuns4w = recent.filter((r) => r.distanceM / 1000 >= 18).length;
  if (longRuns4w >= 1) signals.push("Strong long-run anchor");
  if (analytics.efficiencySummary.trend === "improving") {
    signals.push("Efficiency trend improving");
  }
  if (signals.length === 0) signals.push("Building session history");

  const interval4w = recentLabels.filter((l) => l.classification.type === "interval").length;

  const recentBehavior = topMix
    ? `${roundPct(topMix.pct)}% ${topMix.label.toLowerCase()} share · ${analytics.intensityAdvice.hardRunsLast14d} hard sessions in 14d`
    : `${recent.length} sessions in 56d`;

  let trainingEmphasis = "Aerobic consistency + controlled quality";
  if (analytics.raceReadiness) {
    trainingEmphasis = `${analytics.raceReadiness.distanceLabel} durability + threshold support`;
  } else if (hardPct >= 30) {
    trainingEmphasis = "Threshold support + recovery spacing";
  }

  const readinessScore = analytics.raceReadiness?.score ?? analytics.halfMarathonReadiness.score;
  const volTrend =
    analytics.weeklyVolume.length >= 2 &&
    (analytics.weeklyVolume.at(-1)?.distanceKm ?? 0) >=
      (analytics.weeklyVolume.at(-2)?.distanceKm ?? 0)
      ? "Building"
      : "Easing";

  const hero: RunsHeroView = {
    title: "Training history overview",
    trainingIdentity,
    signals,
    recentBehavior,
    trainingEmphasis,
    stateCard: {
      readiness: `${readinessScore}/100 · ${(analytics.raceReadiness?.label ?? analytics.halfMarathonReadiness.label).toLowerCase()}`,
      consistency: `${analytics.consistencyScore.overall}/100 · ${analytics.consistencyScore.label.toLowerCase()}`,
      easyShare: `${roundPct(analytics.intensityAdvice.currentEasyPct)}% easy`,
      frequency: `${Math.round(recent.length / 8) || recent.length} runs/wk (56d)`,
      volumeTrend: volTrend,
      phase: analytics.raceReadiness
        ? analytics.raceReadiness.daysUntilRace <= 14
          ? "Race week"
          : analytics.raceReadiness.daysUntilRace <= 28
            ? "Taper / sharpen"
            : "Build"
        : "General fitness",
    },
    runCount: runs.length,
    totalKm: formatKm(totalKm),
    confidence: analytics.dataConfidence,
  };

  const mixParts = analytics.workoutTypeMix
    .filter((m) => m.pct >= 4)
    .map((m) => `${m.label} ${roundPct(m.pct)}%`)
    .join(" · ");

  const distribution: TrainingDistributionView = {
    mix: analytics.workoutTypeMix.map((m) => ({
      type: m.type,
      label: m.label,
      pct: roundPct(m.pct),
      runCount: m.runCount,
    })),
    modalityLine: "Running-led · see Training for cross-training",
    intensityLine: mixParts || "Mixed intensity",
    frequencyLine: `${Math.round(recent.length / 8) || recent.length} sessions/wk · ${recent.length} in 56d`,
    longRunRhythm: longRuns4w >= 2 ? "Stable" : longRuns4w === 1 ? "Single anchor" : "Gap emerging",
    intervalDensity: interval4w >= 2 ? "Regular stimulus" : interval4w === 1 ? "Light" : "Low",
    consistencyLine:
      analytics.consistencyScore.streakWeeks >= 3
        ? "Improving"
        : analytics.consistencyScore.overall >= 70
          ? "Stable"
          : "Variable",
  };

  const activityState: ActivityStateSummaryView = {
    headline: trainingIdentity,
    bullets: [...signals.map((s) => s), recentBehavior, `Emphasis: ${trainingEmphasis}`],
  };

  const recent56 = recentRuns(runs);
  const maxLoad = Math.max(...recent56.map((r) => r.trainingLoad ?? (r.distanceM / 1000) * 10), 1);
  const maxDist56 = Math.max(...recent56.map((r) => r.distanceM / 1000), 0);

  const efficientIds = new Set(
    analytics.efficiencyTrend
      .slice(-12)
      .sort((a, b) => a.efficiency - b.efficiency)
      .slice(0, 3)
      .map((e) => {
        const match = runs.find((r) => r.name === e.runName);
        return match?.id;
      })
      .filter((id): id is string => !!id),
  );

  const explorerRows: RunExplorerRow[] = [...runs]
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    .map((run) => {
      const workout = workoutMap.get(run.id) ?? {
        type: "unknown" as WorkoutType,
        confidence: "low" as const,
        signals: [],
      };
      const markers = buildMarkers(run, workout, prByRun, maxLoad, maxDist56, efficientIds);
      const pace = paceSecPerKm(run);
      const km = run.distanceM / 1000;
      const score = significanceScoreFromMarkers(markers, workout);
      const exec = executionFromMarkers(markers, workout);
      const gKey = monthKeyFromDate(run.date);
      return {
        runId: run.id,
        date: run.date,
        dateDisplay: format(parseISO(run.date), "MMM d, yyyy"),
        formattedTitle: formatWorkoutTitle(run.name),
        rawName: run.name,
        workout,
        purpose: SESSION_PURPOSE[workout.type],
        impact: SESSION_IMPACT[workout.type],
        markers,
        distanceDisplay: formatDistanceKm(run.distanceM),
        distanceKm: km,
        paceDisplay: pace ? formatPace(pace) : "—",
        paceSec: pace ?? 99999,
        hrDisplay: run.avgHr != null ? `${Math.round(run.avgHr)} bpm` : "—",
        loadDisplay: run.trainingLoad != null ? String(Math.round(run.trainingLoad)) : null,
        loadValue: run.trainingLoad ?? null,
        hasFit: fitRunIds.includes(run.id),
        significanceScore: score,
        significanceTier: tierFromScore(score),
        executionLabel: exec.label,
        executionRank: exec.rank,
        adaptationTags: adaptationTagsFor(workout, markers),
        groupKey: gKey,
        groupLabel: monthLabelFromKey(gKey),
      };
    });

  const classConf = classificationConfidenceNote(analytics.workoutLabels);
  const hrField = quality?.fieldCoverage.find((f) => f.label.toLowerCase().includes("heart"));

  const notableSessions = buildNotableSessions(runs, analytics, workoutMap, prByRun);

  return {
    activityState,
    hero,
    distribution,
    notableSessions,
    intelligenceSessions: notableSessions,
    patterns: buildPatterns(analytics, analytics.workoutLabels),
    historical: buildHistorical(analytics),
    quality: {
      hrCoveragePct: hrField
        ? Math.round((hrField.count / hrField.total) * 100)
        : Math.round((runs.filter((r) => r.avgHr != null).length / Math.max(runs.length, 1)) * 100),
      fitCount: fitRunIds.length,
      classificationNote: classConf.note,
      confidenceByType: classConf.byType,
      warnings: quality?.warnings.slice(0, 3) ?? [],
    },
    explorerRows,
  };
}
