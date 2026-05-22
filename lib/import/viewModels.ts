import type { ImportQualityReport } from "@/lib/quality/assessImport";
import type { DataSources } from "@/lib/data/mergeImport";
import type { StravaImport } from "@/lib/strava/types";
import {
  modalityCoverageFromImport,
  modalityCoverageRows,
  type ModalityCoverageRow,
} from "@/lib/ecosystem/coverage";

export interface CapabilityItem {
  id: string;
  label: string;
  unlocked: boolean;
  reason?: string;
}

export interface CoverageRowView {
  id: string;
  label: string;
  count: number;
  total: number;
  level: "low" | "medium" | "high";
  impact: string;
}

export interface ImportHeroView {
  title: string;
  subtitle: string;
  ingestionSummary: string;
  qualityNarrative: string;
  fitNarrative: string;
  recommendation: string;
  unlockedCapabilities: string[];
  missingCapabilities: string[];
  confidenceScore: number;
  confidenceLabel: string;
  overallConfidence: "low" | "medium" | "high";
  streamCoveragePct: number;
  hasData: boolean;
}

export interface ConnectedSourceView {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "partial";
  statusLabel: string;
  confidence: "low" | "medium" | "high";
  runsSynced: number;
  activitiesAvailable: number;
  streamsLoaded: number;
  streamsPending: number;
  lastSyncHint: string | null;
  enabledCapabilities: string[];
  missingItems: string[];
}

export interface FitComparisonView {
  without: string[];
  with: string[];
  coverageLabel: string;
  confidenceGain: string;
}

export interface ProcessingStepView {
  label: string;
  active: boolean;
  done: boolean;
}

export interface MissingGuidanceView {
  title: string;
  severity: "info" | "warning" | "critical";
  impact: string;
  action: string;
}

export interface TrustTopicView {
  title: string;
  body: string;
}

export type { ModalityCoverageRow };

export interface ImportPageView {
  hero: ImportHeroView;
  sources: ConnectedSourceView[];
  coverage: CoverageRowView[];
  modalityCoverage: ModalityCoverageRow[];
  capabilities: CapabilityItem[];
  fitComparison: FitComparisonView;
  missingGuidance: MissingGuidanceView[];
  trustTopics: TrustTopicView[];
  processingSteps: ProcessingStepView[];
  processingMessage: string | null;
  emptyState: "none" | "no_connection" | "low_sample" | null;
  dataSourceLabel: string | null;
}

function confidenceScore(report: ImportQualityReport): number {
  const weights = { high: 100, medium: 65, low: 35 };
  const fields = report.fieldCoverage.filter((f) => f.label !== "Distance & time");
  if (fields.length === 0) return 50;
  const avg =
    fields.reduce((s, f) => s + weights[f.level], 0) / fields.length;
  const sampleBonus = report.runCount >= 40 ? 8 : report.runCount >= 15 ? 4 : 0;
  return Math.min(100, Math.round(avg + sampleBonus));
}

function buildCapabilities(
  report: ImportQualityReport,
  apiConnected: boolean
): CapabilityItem[] {
  const hr = report.fieldCoverage.find((f) => f.label === "Heart rate");
  const fit = report.fieldCoverage.find((f) => f.label === "FIT streams");
  const hrRatio = hr && hr.total ? hr.count / hr.total : 0;
  const fitRatio = fit && fit.total ? fit.count / fit.total : 0;

  return [
    {
      id: "readiness",
      label: "Readiness modeling",
      unlocked: report.runCount >= 8 && hrRatio >= 0.4,
      reason: report.runCount < 8 ? "Need more runs" : "HR coverage too low",
    },
    {
      id: "trends",
      label: "Trend & load analysis",
      unlocked: report.runCount >= 5,
      reason: "Import at least 5 runs",
    },
    {
      id: "intervals",
      label: "Interval detection",
      unlocked: fitRatio >= 0.15 || report.fitParsed >= 3,
      reason: "Add FIT streams for lap-level structure",
    },
    {
      id: "pacing",
      label: "Pacing intelligence",
      unlocked: hrRatio >= 0.6 && report.runCount >= 10,
      reason: "Need HR on most runs",
    },
    {
      id: "race",
      label: "Race projections",
      unlocked: report.runCount >= 10 && hrRatio >= 0.5,
      reason: "Need quality efforts + HR",
    },
    {
      id: "execution",
      label: "Workout execution scoring",
      unlocked: fitRatio >= 0.25 || report.fitParsed >= 8,
      reason: "FIT streams unlock session-level scoring",
    },
    {
      id: "api",
      label: "Live Strava sync",
      unlocked: apiConnected,
      reason: "Connect Strava API",
    },
  ];
}

function buildCoverage(report: ImportQualityReport): CoverageRowView[] {
  const impacts: Record<string, string> = {
    "Heart rate": "Effort zones, load, and aerobic efficiency need HR.",
    "Elevation": "Course-adjusted pacing and climb context.",
    "Training load": "Fatigue modeling and TSB when load is present.",
    Cadence: "Form and rhythm signals on steady runs.",
    "FIT streams": "Intervals, splits, drift, and execution analysis.",
    "Distance & time": "Core volume and pace trends.",
  };

  return report.fieldCoverage.map((f) => ({
    id: f.label,
    label: f.label,
    count: f.count,
    total: f.total,
    level: f.level,
    impact: impacts[f.label] ?? "Supports model confidence.",
  }));
}

function buildMissingGuidance(
  report: ImportQualityReport,
  apiConnected: boolean,
  hasData: boolean
): MissingGuidanceView[] {
  const items: MissingGuidanceView[] = [];

  if (!hasData) {
    items.push({
      title: "No training data ingested",
      severity: "critical",
      impact: "Home, training, and race intelligence cannot run without activities.",
      action: "Connect Strava or import a bulk export folder below.",
    });
    return items;
  }

  if (!apiConnected) {
    items.push({
      title: "Strava API not connected",
      severity: "info",
      impact: "Manual export works, but live sync and on-demand streams require API.",
      action: "Connect Strava for automatic updates and stream backfill.",
    });
  }

  const fit = report.fieldCoverage.find((f) => f.label === "FIT streams");
  if (fit && fit.total > 0 && fit.count / fit.total < 0.2) {
    items.push({
      title: "Limited FIT stream coverage",
      severity: "warning",
      impact: "Workout pages stay summary-only; intervals and drift analysis stay shallow.",
      action: "Upload the activities folder from your Strava archive or sync streams via API.",
    });
  }

  const hr = report.fieldCoverage.find((f) => f.label === "Heart rate");
  if (hr && hr.total > 0 && hr.count / hr.total < 0.5) {
    items.push({
      title: "Partial heart rate coverage",
      severity: "warning",
      impact: "Readiness and intensity advice use proxies — confidence is reduced.",
      action: "Wear a chest or optical HR monitor on easy and quality runs.",
    });
  }

  if (report.runCount < 15) {
    items.push({
      title: "Small training sample",
      severity: "info",
      impact: "Predictions and trends are indicative, not definitive.",
      action: "Import full history or sync more activities from Strava.",
    });
  }

  if (items.length === 0) {
    items.push({
      title: "Data foundation is solid",
      severity: "info",
      impact: "Continue syncing — the system refines readiness and projections as you train.",
      action: "Sync after big weeks; add FIT files for key workouts.",
    });
  }

  return items.slice(0, 4);
}

export function buildImportPageView(
  report: ImportQualityReport | null,
  opts: {
    apiConnected: boolean;
    dataSources: DataSources;
    dataSourceLabel: string | null;
    fitParsed: number;
    streamsFromApi?: number;
    runsMissingStreams?: number;
    parsing: boolean;
    loading: boolean;
    lastImport?: string;
    importData?: StravaImport | null;
  }
): ImportPageView {
  const modalityCoverage = opts.importData
    ? modalityCoverageRows(modalityCoverageFromImport(opts.importData))
    : [];
  const hasData = (report?.runCount ?? 0) > 0;

  if (!report || !hasData) {
    const emptyHero: ImportHeroView = {
      title: "Training data not connected",
      subtitle: "Connect sources to unlock intelligence",
      ingestionSummary: "No runs ingested yet",
      qualityNarrative: "StrideIQ analyzes locally — nothing leaves your device without Strava API sync.",
      fitNarrative: "FIT streams are optional but unlock the deepest workout intelligence.",
      recommendation: "Start with Strava API for seamless sync, or import a full export for history.",
      unlockedCapabilities: [],
      missingCapabilities: [
        "Readiness modeling",
        "Race projections",
        "Interval analysis",
        "Pacing intelligence",
      ],
      confidenceScore: 0,
      confidenceLabel: "Awaiting data",
      overallConfidence: "low",
      streamCoveragePct: 0,
      hasData: false,
    };

    return {
      hero: emptyHero,
      sources: [
        {
          id: "strava",
          name: "Strava API",
          status: opts.apiConnected ? "connected" : "disconnected",
          statusLabel: opts.apiConnected ? "Connected" : "Not connected",
          confidence: "low",
          runsSynced: 0,
          activitiesAvailable: 0,
          streamsLoaded: 0,
          streamsPending: 0,
          lastSyncHint: null,
          enabledCapabilities: opts.apiConnected ? ["Live sync"] : [],
          missingItems: ["Training history", "Stream backfill"],
        },
        {
          id: "export",
          name: "Bulk export",
          status: opts.dataSources.localExport ? "partial" : "disconnected",
          statusLabel: opts.dataSources.localExport ? "Partial" : "Not imported",
          confidence: "low",
          runsSynced: 0,
          activitiesAvailable: 0,
          streamsLoaded: 0,
          streamsPending: 0,
          lastSyncHint: opts.lastImport
            ? `Last import ${new Date(opts.lastImport).toLocaleDateString()}`
            : null,
          enabledCapabilities: [],
          missingItems: ["activities.csv", "FIT activities folder"],
        },
      ],
      coverage: [],
      modalityCoverage: [],
      capabilities: buildCapabilities(
        {
          runCount: 0,
          activityCount: 0,
          fitParsed: 0,
          fitReferenced: 0,
          skippedFit: 0,
          lastImport: new Date().toISOString(),
          fieldCoverage: [],
          warnings: [],
          overallConfidence: "low",
          sportTypes: [],
        },
        opts.apiConnected
      ),
      fitComparison: {
        without: ["Basic run summaries", "Weekly volume trends", "Manual PR tables"],
        with: [
          "Interval detection",
          "HR drift analysis",
          "Pacing consistency",
          "Workout execution scoring",
          "Advanced race modeling",
        ],
        coverageLabel: "0% stream coverage",
        confidenceGain: "Upload FIT files to raise prediction confidence significantly.",
      },
      missingGuidance: buildMissingGuidance(
        {
          runCount: 0,
          activityCount: 0,
          fitParsed: 0,
          fitReferenced: 0,
          skippedFit: 0,
          lastImport: new Date().toISOString(),
          fieldCoverage: [],
          warnings: [],
          overallConfidence: "low",
          sportTypes: [],
        },
        opts.apiConnected,
        false
      ),
      trustTopics: defaultTrustTopics(),
      processingSteps: buildProcessingSteps(opts),
      processingMessage: opts.parsing
        ? "Analyzing workout structure…"
        : opts.loading
          ? "Ingesting training data…"
          : null,
      emptyState: opts.apiConnected ? "low_sample" : "no_connection",
      dataSourceLabel: opts.dataSourceLabel,
    };
  }

  const fitField = report.fieldCoverage.find((f) => f.label === "FIT streams");
  const streamPct =
    fitField && fitField.total > 0
      ? Math.round((fitField.count / fitField.total) * 100)
      : report.fitParsed > 0
        ? Math.round((report.fitParsed / report.runCount) * 100)
        : 0;

  const hrField = report.fieldCoverage.find((f) => f.label === "Heart rate");
  const hrHigh = hrField && hrField.total > 0 && hrField.count / hrField.total >= 0.85;

  const capabilities = buildCapabilities(report, opts.apiConnected);
  const unlocked = capabilities.filter((c) => c.unlocked).map((c) => c.label);
  const missing = capabilities.filter((c) => !c.unlocked).map((c) => c.label);

  const score = confidenceScore(report);
  const confLabel =
    report.overallConfidence === "high"
      ? "High confidence"
      : report.overallConfidence === "medium"
        ? "Medium-high confidence"
        : "Building confidence";

  const hero: ImportHeroView = {
    title: "Training data connected",
    subtitle: `${report.runCount} runs · ${report.activityCount} activities`,
    ingestionSummary: opts.dataSourceLabel ?? "Local training archive",
    qualityNarrative: hrHigh
      ? "Strong pace + HR analysis available."
      : "Pace trends available — HR coverage limits effort modeling.",
    fitNarrative:
      streamPct >= 50
        ? "FIT stream coverage supports advanced workout intelligence."
        : streamPct > 0
          ? "FIT stream coverage partially complete — add more for full execution analysis."
          : "No FIT streams yet — summaries only on workout pages.",
    recommendation:
      streamPct < 30
        ? "Upload FIT activities or sync streams — biggest lift to prediction and workout depth."
        : report.runCount < 25
          ? "Import full history or sync more runs for sharper progression curves."
          : "Maintain sync after key weeks; system confidence improves automatically.",
    unlockedCapabilities: unlocked,
    missingCapabilities: missing.slice(0, 4),
    confidenceScore: score,
    confidenceLabel: confLabel,
    overallConfidence: report.overallConfidence,
    streamCoveragePct: streamPct,
    hasData: true,
  };

  const sources: ConnectedSourceView[] = [
    {
      id: "strava",
      name: "Strava API",
      status: opts.apiConnected ? "connected" : "disconnected",
      statusLabel: opts.apiConnected ? "Connected" : "Not connected",
      confidence: opts.apiConnected ? report.overallConfidence : "low",
      runsSynced: opts.apiConnected ? report.runCount : 0,
      activitiesAvailable: report.activityCount,
      streamsLoaded:
        opts.streamsFromApi ??
        (opts.apiConnected ? report.fitParsed : 0),
      streamsPending: opts.runsMissingStreams ?? 0,
      lastSyncHint: opts.apiConnected ? "Use Sync now to refresh activities" : null,
      enabledCapabilities: opts.apiConnected
        ? ["Live sync", "On-demand streams", "Trend analysis"]
        : [],
      missingItems: opts.apiConnected
        ? (opts.runsMissingStreams ?? 0) > 0
          ? [`${opts.runsMissingStreams} runs need stream sync`]
          : []
        : ["OAuth connection"],
    },
    {
      id: "export",
      name: "Historical export",
      status: opts.dataSources.localExport ? "connected" : "disconnected",
      statusLabel: opts.dataSources.localExport ? "Imported" : "Optional",
      confidence: opts.dataSources.localExport ? report.overallConfidence : "low",
      runsSynced: opts.dataSources.localExport ? report.runCount : 0,
      activitiesAvailable: report.activityCount,
      streamsLoaded: report.fitParsed,
      streamsPending: report.skippedFit,
      lastSyncHint: report.exportLabel ?? null,
      enabledCapabilities: opts.dataSources.localExport
        ? [
            "Long-term progression",
            "Performance curves",
            "Historical readiness",
          ]
        : [],
      missingItems: opts.dataSources.localExport
        ? report.skippedFit > 0
          ? [`${report.skippedFit} FIT files referenced but not parsed`]
          : []
        : ["Bulk CSV + optional FIT folder"],
    },
  ];

  return {
    hero,
    sources,
    coverage: buildCoverage(report),
    modalityCoverage,
    capabilities,
    fitComparison: {
      without: [
        "Basic run summaries",
        "Weekly volume & pace trends",
        "Table-based PR detection",
      ],
      with: [
        "Interval & rep detection",
        "HR drift & pacing telemetry",
        "Split-level execution scoring",
        "Segment PRs inside long runs",
        "Sharper race projection models",
      ],
      coverageLabel: `${streamPct}% FIT stream coverage (${report.fitParsed}/${report.runCount} runs)`,
      confidenceGain:
        streamPct < 50
          ? "Adding FIT streams typically raises workout and race confidence one tier."
          : "Stream depth is strong — focus on consistent HR on easy days.",
    },
    missingGuidance: buildMissingGuidance(report, opts.apiConnected, true),
    trustTopics: defaultTrustTopics(),
    processingSteps: buildProcessingSteps(opts),
    processingMessage: opts.parsing
      ? opts.loading
        ? "Analyzing workout structure…"
        : "Building performance baselines…"
      : opts.loading
        ? "Ingesting training archive…"
        : null,
    emptyState: report.runCount < 5 ? "low_sample" : null,
    dataSourceLabel: opts.dataSourceLabel,
  };
}

function defaultTrustTopics(): TrustTopicView[] {
  return [
    {
      title: "Local-first processing",
      body: "Export data is parsed in your browser. Strava API tokens stay server-side only for sync you initiate.",
    },
    {
      title: "How workouts are classified",
      body: "Easy, tempo, interval, and long runs are inferred from pace, HR zones, and duration — not manual tags.",
    },
    {
      title: "Readiness estimates",
      body: "Scores combine recent volume, longest run, fatigue (TSB), and consistency — not medical clearance.",
    },
    {
      title: "Race predictions",
      body: "Models extrapolate from quality efforts; spread reflects disagreement and sample size — not guarantees.",
    },
  ];
}

function buildProcessingSteps(opts: {
  parsing: boolean;
  loading: boolean;
}): ProcessingStepView[] {
  const active = opts.loading || opts.parsing;
  return [
    {
      label: "Ingest activities",
      active: active && !opts.parsing,
      done: !active,
    },
    {
      label: "Parse FIT streams",
      active: opts.parsing,
      done: !opts.parsing && !opts.loading,
    },
    {
      label: "Compute readiness baseline",
      active: false,
      done: !active,
    },
    {
      label: "Update intelligence models",
      active: false,
      done: !active,
    },
  ];
}
