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
import { parseISO, subDays } from "date-fns";

export type RunMarker = "pr" | "long" | "key" | "high_load" | "efficient";

export interface RunsHeroView {
  title: string;
  blockEmphasis: string;
  commonSession: string;
  currentTrend: string;
  runCount: number;
  totalKm: string;
  typeCount: number;
  confidence: "low" | "medium" | "high";
  mixSparkline: number[];
  loadSparkline: number[];
  easyPct: number;
  inlineMetrics: { label: string; value: string; hint?: string }[];
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
  widgets: DistributionWidget[];
  easyHardLabel: string;
  longRunFreq: string;
  intervalDensity: string;
}

export interface NotableSessionView {
  id: string;
  runId: string;
  title: string;
  meta: string;
  why: string;
  signal: string;
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
  paceDisplay: string;
  hrDisplay: string;
  loadDisplay: string | null;
  hasFit: boolean;
  isKeyRow: boolean;
}

export interface PatternInsightView {
  title: string;
  body: string;
  tone: "positive" | "neutral" | "warning";
}

export interface HistoricalContextView {
  items: { label: string; value: string }[];
}

export interface RunsDataQualityView {
  hrCoveragePct: number;
  fitCount: number;
  classificationNote: string;
  confidenceByType: { type: string; level: string }[];
  warnings: string[];
}

export interface RunsPageView {
  hero: RunsHeroView;
  distribution: TrainingDistributionView;
  notableSessions: NotableSessionView[];
  patterns: PatternInsightView[];
  historical: HistoricalContextView;
  quality: RunsDataQualityView;
  explorerRows: RunExplorerRow[];
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

function buildMarkers(
  run: RunActivity,
  workout: WorkoutClassification,
  prByRun: Map<string, PersonalRecord>,
  maxLoad: number,
  maxDist56: number,
  efficientRunIds: Set<string>
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
  prByRun: Map<string, PersonalRecord>
): NotableSessionView[] {
  const sessions: NotableSessionView[] = [];
  const sorted = [...runs].sort(
    (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
  );

  for (const pr of analytics.personalRecords.filter((p) =>
    ["5k", "10k", "hm"].includes(p.bucket)
  )) {
    sessions.push({
      id: `pr-${pr.bucket}`,
      runId: pr.runId,
      title: `New ${pr.label} PR`,
      meta: formatPace(pr.paceSecPerKm),
      why: "Validates speed progression in your current block.",
      signal: "Performance breakthrough",
      href: `/runs/${pr.runId}`,
    });
  }

  const longest = [...sorted].sort((a, b) => b.distanceM - a.distanceM)[0];
  if (longest && longest.distanceM / 1000 >= 12) {
    sessions.push({
      id: "longest",
      runId: longest.id,
      title: "Longest recent run",
      meta: formatDistanceKm(longest.distanceM),
      why: "Anchors endurance capacity for race readiness.",
      signal: "Endurance anchor",
      href: `/runs/${longest.id}`,
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
      title: "Highest load session",
      meta: workoutMap.get(byLoad.r.id)
        ? WORKOUT_TYPE_LABELS[workoutMap.get(byLoad.r.id)!.type]
        : "—",
      why: "Largest training stress in recent history — recovery timing matters.",
      signal: "Load peak",
      href: `/runs/${byLoad.r.id}`,
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
      why: "Fastest pace relative to heart rate in recent sample.",
      signal: "Adaptation signal",
      href: effRun ? `/runs/${effRun.id}` : "/performance",
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
      title: "Key quality session",
      meta: WORKOUT_TYPE_LABELS[workoutMap.get(hardRecent.id)!.type],
      why: "Structured intensity supporting threshold/fitness.",
      signal: "Quality stimulus",
      href: `/runs/${hardRecent.id}`,
    });
  }

  return sessions.slice(0, 6);
}

function buildPatterns(
  analytics: DashboardInsights,
  labels: RunWorkoutLabel[]
): PatternInsightView[] {
  const patterns: PatternInsightView[] = [];
  const mix = analytics.workoutTypeMix;
  const top = [...mix].sort((a, b) => b.runCount - a.runCount)[0];
  const hardPct =
    mix
      .filter((m) =>
        ["tempo", "interval", "race"].includes(m.type)
      )
      .reduce((s, m) => s + m.pct, 0) ?? 0;

  if (top && top.pct >= 35) {
    patterns.push({
      title: `${top.label}-leaning block`,
      body: `${Math.round(top.pct)}% of recent sessions classified as ${top.label.toLowerCase()} — shapes your current training identity.`,
      tone: top.type === "easy" || top.type === "recovery" ? "positive" : "neutral",
    });
  }

  if (hardPct >= 30) {
    patterns.push({
      title: "Threshold-heavy training block",
      body: `${Math.round(hardPct)}% tempo/interval/race share — monitor freshness between quality days.`,
      tone: "warning",
    });
  } else if (analytics.intensityAdvice.currentEasyPct >= 75) {
    patterns.push({
      title: "Polarized easy-volume base",
      body: `${analytics.intensityAdvice.currentEasyPct}% easy runs — supports aerobic development when consistency holds.`,
      tone: "positive",
    });
  }

  if (analytics.efficiencySummary.trend === "improving") {
    patterns.push({
      title: "Pace stability improving",
      body: "Aerobic efficiency trend is positive — you're tending to run faster at similar heart rates.",
      tone: "positive",
    });
  }

  const longCount = mix.find((m) => m.type === "long")?.runCount ?? 0;
  if (longCount >= 2) {
    patterns.push({
      title: "Long-run consistency building",
      body: `${longCount} long runs in the recent window — endurance structure is taking shape.`,
      tone: "positive",
    });
  } else if (longCount === 0 && analytics.summary.runCount >= 15) {
    patterns.push({
      title: "Long-run gap in recent block",
      body: "No 18 km+ classified long runs recently — consider scheduling an aerobic anchor.",
      tone: "warning",
    });
  }

  const intervalCount = mix.find((m) => m.type === "interval")?.runCount ?? 0;
  if (intervalCount === 0 && hardPct < 15) {
    patterns.push({
      title: "Limited speed stimulus",
      body: "Few intervals detected — top-end sharpness may need a touch of VO₂ work.",
      tone: "neutral",
    });
  }

  if (patterns.length === 0) {
    patterns.push({
      title: "Establishing training rhythm",
      body: `${labels.length} classified sessions — patterns will sharpen as HR and FIT coverage grow.`,
      tone: "neutral",
    });
  }

  return patterns.slice(0, 5);
}

function buildHistorical(analytics: DashboardInsights): HistoricalContextView {
  const items: { label: string; value: string }[] = [];

  if (analytics.bestBlock) {
    items.push({
      label: "Best 4-week block",
      value: `${analytics.bestBlock.label} · ${formatKm(analytics.bestBlock.distanceKm)}`,
    });
  }

  const months = analytics.monthlyVolume;
  if (months.length > 0) {
    const best = [...months].sort((a, b) => b.distanceKm - a.distanceKm)[0];
    items.push({
      label: "Highest volume month",
      value: `${best.label} · ${formatKm(best.distanceKm)}`,
    });
  }

  const weeks = analytics.weeklyVolume;
  if (weeks.length > 0) {
    const peak = [...weeks].sort((a, b) => b.distanceKm - a.distanceKm)[0];
    items.push({
      label: "Peak week",
      value: `${peak.label} · ${formatKm(peak.distanceKm)} (${peak.runCount} runs)`,
    });
  }

  items.push({
    label: "Active streak",
    value: `${analytics.consistencyScore.streakWeeks} week${analytics.consistencyScore.streakWeeks === 1 ? "" : "s"}`,
  });

  if (analytics.efficiencyMoM.narrative) {
    items.push({
      label: "Strongest progression signal",
      value: analytics.efficiencyMoM.narrative.slice(0, 80) + (analytics.efficiencyMoM.narrative.length > 80 ? "…" : ""),
    });
  }

  return { items };
}

function classificationConfidenceNote(
  labels: RunWorkoutLabel[]
): { note: string; byType: { type: string; level: string }[] } {
  const recent = labels.slice(-40);
  const high = recent.filter((l) => l.classification.confidence === "high").length;
  const med = recent.filter((l) => l.classification.confidence === "medium").length;
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
      level:
        v.high / v.total >= 0.6
          ? "High"
          : v.high / v.total >= 0.35
            ? "Medium"
            : "Low",
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
  quality: ImportQualityReport | null
): RunsPageView {
  const workoutMap = new Map(
    analytics.workoutLabels.map((l) => [l.runId, l.classification])
  );
  const prByRun = prBuckets(analytics.personalRecords);
  const recent = recentRuns(runs);
  const recentLabels = analytics.workoutLabels.filter((l) =>
    recent.some((r) => r.id === l.runId)
  );

  const typeSet = new Set(recentLabels.map((l) => l.classification.type));
  const totalKm = runs.reduce((s, r) => s + r.distanceM, 0) / 1000;

  const topMix = [...analytics.workoutTypeMix].sort(
    (a, b) => b.runCount - a.runCount
  )[0];

  const hardPct = analytics.workoutTypeMix
    .filter((m) => ["tempo", "interval", "race"].includes(m.type))
    .reduce((s, m) => s + m.pct, 0);

  let blockEmphasis = "Balanced mixed training";
  if (hardPct >= 30) blockEmphasis = "Elevated threshold / quality density";
  else if (analytics.intensityAdvice.currentEasyPct >= 78)
    blockEmphasis = "Aerobic-base emphasis with controlled quality";

  if (analytics.efficiencySummary.trend === "improving") {
    blockEmphasis += " · efficiency improving";
  }

  const weekRuns = analytics.weeklyVolume.slice(-8).map((w) => w.runCount);
  const loadSpark = analytics.weeklyVolume.slice(-10).map((w) => w.distanceKm);

  const longRuns4w = recent.filter((r) => r.distanceM / 1000 >= 18).length;
  const interval4w = recentLabels.filter(
    (l) => l.classification.type === "interval"
  ).length;

  const hero: RunsHeroView = {
    title: "Training history overview",
    blockEmphasis,
    commonSession: topMix
      ? `${topMix.label} (${Math.round(topMix.pct)}% of recent runs)`
      : "Mixed sessions",
    currentTrend:
      analytics.consistencyScore.streakWeeks >= 3
        ? "Weekly consistency improving"
        : analytics.efficiencySummary.trend === "improving"
          ? "Aerobic response improving"
          : "Building activity history",
    runCount: runs.length,
    totalKm: formatKm(totalKm),
    typeCount: typeSet.size,
    confidence: analytics.dataConfidence,
    mixSparkline: weekRuns.length >= 2 ? weekRuns : [1, 2, 2, 3],
    loadSparkline: loadSpark,
    easyPct: analytics.intensityAdvice.currentEasyPct,
    inlineMetrics: [
      {
        label: "Recent",
        value: String(recent.length),
        hint: "56d window",
      },
      {
        label: "Easy %",
        value: `${analytics.intensityAdvice.currentEasyPct}%`,
        hint: `target ~${analytics.intensityAdvice.easyTargetPct}%`,
      },
      {
        label: "Consistency",
        value: String(analytics.consistencyScore.overall),
        hint: analytics.consistencyScore.label,
      },
    ],
  };

  const distribution: TrainingDistributionView = {
    mix: analytics.workoutTypeMix.map((m) => ({
      type: m.type,
      label: m.label,
      pct: Math.round(m.pct),
      runCount: m.runCount,
    })),
    widgets: [
      {
        label: "Runs (56d)",
        value: String(recent.length),
      },
      {
        label: "Avg / week",
        value: String(
          Math.round((recent.length / 8) * 10) / 10 || recent.length
        ),
        hint: "frequency",
      },
      {
        label: "Long runs",
        value: String(longRuns4w),
        hint: "18 km+",
      },
      {
        label: "Intervals",
        value: String(interval4w),
        hint: "56d",
      },
    ],
    easyHardLabel: `${analytics.intensityAdvice.currentEasyPct}% easy · ${analytics.intensityAdvice.hardRunsLast14d} hard sessions (14d)`,
    longRunFreq:
      longRuns4w >= 2
        ? "Regular long-run rhythm"
        : longRuns4w === 1
          ? "Single long run recently"
          : "No recent 18 km+ long run",
    intervalDensity:
      interval4w >= 2
        ? "Regular interval stimulus"
        : interval4w === 1
          ? "Light interval density"
          : "Low interval frequency",
  };

  const recent56 = recentRuns(runs);
  const maxLoad = Math.max(
    ...recent56.map((r) => r.trainingLoad ?? (r.distanceM / 1000) * 10),
    1
  );
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
      .filter((id): id is string => !!id)
  );

  const explorerRows: RunExplorerRow[] = [...runs]
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    .map((run) => {
      const workout = workoutMap.get(run.id) ?? {
        type: "unknown" as WorkoutType,
        confidence: "low" as const,
        signals: [],
      };
      const markers = buildMarkers(
        run,
        workout,
        prByRun,
        maxLoad,
        maxDist56,
        efficientIds
      );
      const pace = paceSecPerKm(run);
      return {
        runId: run.id,
        date: run.date,
        dateDisplay: new Date(run.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        formattedTitle: formatWorkoutTitle(run.name),
        rawName: run.name,
        workout,
        purpose: SESSION_PURPOSE[workout.type],
        impact: SESSION_IMPACT[workout.type],
        markers,
        distanceDisplay: formatDistanceKm(run.distanceM),
        paceDisplay: pace ? formatPace(pace) : "—",
        hrDisplay: run.avgHr != null ? `${run.avgHr} bpm` : "—",
        loadDisplay:
          run.trainingLoad != null
            ? String(Math.round(run.trainingLoad))
            : null,
        hasFit: fitRunIds.includes(run.id),
        isKeyRow: markers.includes("pr") || markers.includes("key"),
      };
    });

  const classConf = classificationConfidenceNote(analytics.workoutLabels);
  const hrField = quality?.fieldCoverage.find((f) =>
    f.label.toLowerCase().includes("heart")
  );

  return {
    hero,
    distribution,
    notableSessions: buildNotableSessions(
      runs,
      analytics,
      workoutMap,
      prByRun
    ),
    patterns: buildPatterns(analytics, analytics.workoutLabels),
    historical: buildHistorical(analytics),
    quality: {
      hrCoveragePct: hrField
        ? Math.round((hrField.count / hrField.total) * 100)
        : Math.round(
            (runs.filter((r) => r.avgHr != null).length / Math.max(runs.length, 1)) *
              100
          ),
      fitCount: fitRunIds.length,
      classificationNote: classConf.note,
      confidenceByType: classConf.byType,
      warnings: quality?.warnings.slice(0, 3) ?? [],
    },
    explorerRows,
  };
}
