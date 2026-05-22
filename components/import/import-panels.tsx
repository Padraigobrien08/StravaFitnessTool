"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { UploadZone } from "@/components/upload-zone";
import { FitUploadZone } from "@/components/fit-upload-zone";
import type {
  CoverageRowView,
  FitComparisonView,
  MissingGuidanceView,
  ModalityCoverageRow,
  ProcessingStepView,
  TrustTopicView,
  CapabilityItem,
} from "@/lib/import/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

const levelBar = {
  high: "bg-teal-500/55",
  medium: "bg-amber-500/45",
  low: "bg-red-500/35",
};

export function DataConfidencePanel({
  coverage,
  warnings,
}: {
  coverage: CoverageRowView[];
  warnings: string[];
}) {
  if (coverage.length === 0) {
    return (
      <PanelChrome title="Data confidence" subdued>
        <p className="text-sm text-zinc-500">
          Import training data to see field coverage and confidence impact.
        </p>
      </PanelChrome>
    );
  }

  return (
    <PanelChrome title="Data confidence" accent elevated>
      <p className={`${dash.muted} mb-4`}>
        Coverage drives model trust — gaps explain reduced readiness and prediction
        confidence.
      </p>
      <div className="space-y-3">
        {coverage.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-300">{row.label}</span>
              <span className="text-xs tabular-nums text-zinc-500">
                {row.count}/{row.total} · {row.level}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn("h-full rounded-full", levelBar[row.level])}
                style={{
                  width: `${row.total ? Math.round((row.count / row.total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-zinc-600">{row.impact}</p>
          </div>
        ))}
      </div>
      {warnings.length > 0 ? (
        <ul className="mt-4 space-y-1 text-xs text-amber-400/90">
          {warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </PanelChrome>
  );
}

export function ModalityCoveragePanel({
  rows,
}: {
  rows: ModalityCoverageRow[];
}) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <PanelChrome title="Modality coverage" subdued>
      <p className={`${dash.muted} mb-3`}>
        Strava <span className="text-zinc-400">sport_type</span> distribution —
        StrideIQ is modality-aware; running stays primary for race intelligence.
      </p>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <span
            key={r.id}
            className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-xs text-zinc-400"
          >
            {r.label}{" "}
            <span className="tabular-nums text-zinc-300">
              {r.count}
              {total > 0 ? ` (${Math.round((r.count / total) * 100)}%)` : ""}
            </span>
          </span>
        ))}
      </div>
    </PanelChrome>
  );
}

export function HistoricalImportPanel({
  onFiles,
  loading,
  error,
  fitProgress,
}: {
  onFiles: (files: File[]) => void;
  loading?: boolean;
  error?: string | null;
  fitProgress?: { done: number; total: number; parsing: boolean };
}) {
  return (
    <PanelChrome title="Historical import" accent>
      <p className={`${dash.muted} mb-3`}>
        Bulk exports unlock long-term progression, performance curves, historical
        readiness trends, and pacing adaptation modeling — especially before API
        history exists.
      </p>
      <ul className="mb-4 space-y-1 text-xs text-zinc-500">
        <li>· Full Strava archive (activities.csv + optional FIT folder)</li>
        <li>· Merges with API data — does not wipe existing import</li>
        <li>· Best for athletes with years of training history</li>
      </ul>
      <UploadZone
        onFiles={onFiles}
        loading={loading}
        error={error}
        fitProgress={fitProgress}
        compact
      />
    </PanelChrome>
  );
}

export function FitIntelligencePanel({
  comparison,
  onFiles,
  loading,
  error,
  success,
  fitProgress,
  runsWithFit,
  totalRuns,
}: {
  comparison: FitComparisonView;
  onFiles: (files: File[]) => void;
  loading?: boolean;
  error?: string | null;
  success?: string | null;
  fitProgress?: { done: number; total: number };
  runsWithFit: number;
  totalRuns: number;
}) {
  return (
    <PanelChrome title="Advanced workout intelligence" elevated>
      <p className={`${dash.muted} mb-4`}>
        FIT streams are StrideIQ&apos;s deepest signal — interval structure, drift,
        and execution scoring all depend on them.
      </p>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className={dash.label}>Without FIT streams</p>
          <ul className="mt-2 space-y-1">
            {comparison.without.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-xs text-zinc-600"
              >
                <X className="h-3 w-3 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.06] p-4">
          <p className={dash.label}>With FIT streams</p>
          <ul className="mt-2 space-y-1">
            {comparison.with.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-xs text-zinc-400"
              >
                <Check className="h-3 w-3 shrink-0 text-teal-500/80" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mb-3 text-xs text-zinc-500">
        <span className="font-medium text-zinc-400">{comparison.coverageLabel}</span>
        {" — "}
        {comparison.confidenceGain}
      </p>

      <FitUploadZone
        onFiles={onFiles}
        loading={loading}
        error={error}
        success={success}
        fitProgress={fitProgress}
        runsWithFit={runsWithFit}
        totalRuns={totalRuns}
        compact
      />
    </PanelChrome>
  );
}

export function ProcessingTrustPanel({
  steps,
  message,
  topics,
}: {
  steps: ProcessingStepView[];
  message: string | null;
  topics: TrustTopicView[];
}) {
  return (
    <PanelChrome title="Processing & trust" subdued>
      {message ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-teal-500/20 bg-teal-500/[0.06] px-3 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
          <span className="text-sm text-teal-200/90">{message}</span>
        </div>
      ) : null}

      <p className={`${dash.muted} mb-3`}>How your data is used</p>
      <ol className="mb-5 space-y-2">
        {steps.map((step, i) => (
          <li
            key={step.label}
            className={cn(
              "flex items-center gap-3 text-xs",
              step.done ? "text-zinc-500" : step.active ? "text-teal-300/90" : "text-zinc-600"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                step.active
                  ? "bg-teal-500/20 text-teal-300"
                  : step.done
                    ? "bg-white/[0.06] text-zinc-500"
                    : "bg-white/[0.04] text-zinc-600"
              )}
            >
              {step.active ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            {step.label}
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        {topics.map((t) => (
          <div
            key={t.title}
            className="rounded-lg bg-white/[0.02] px-3 py-2.5 ring-1 ring-inset ring-white/[0.04]"
          >
            <p className="text-xs font-semibold text-zinc-300">{t.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">{t.body}</p>
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}

export function MissingDataGuidancePanel({
  items,
}: {
  items: MissingGuidanceView[];
}) {
  const severityStyle = {
    critical: "border-l-red-500/50 bg-red-500/[0.04]",
    warning: "border-l-amber-500/45 bg-amber-500/[0.03]",
    info: "border-l-teal-500/30 bg-white/[0.02]",
  };

  return (
    <PanelChrome title="Missing data guidance" accent>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={`${item.title}-${i}`}
            className={cn(
              "rounded-xl border border-white/[0.05] border-l-[3px] px-4 py-3.5",
              severityStyle[item.severity]
            )}
          >
            <h3 className="text-sm font-semibold text-zinc-200">{item.title}</h3>
            <p className="mt-1.5 text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Impact · </span>
              {item.impact}
            </p>
            <p className="mt-2 text-xs text-teal-400/85">
              <span className="font-medium text-teal-400/70">Next step · </span>
              {item.action}
            </p>
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}

export function CapabilitiesMatrixPanel({
  capabilities,
}: {
  capabilities: CapabilityItem[];
}) {
  return (
    <PanelChrome title="Intelligence unlock matrix" subdued>
      <div className="grid gap-2 sm:grid-cols-2">
        {capabilities.map((c) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs ring-1 ring-inset",
              c.unlocked
                ? "bg-teal-500/[0.06] text-zinc-300 ring-teal-500/15"
                : "bg-white/[0.02] text-zinc-600 ring-white/[0.05]"
            )}
          >
            <span>{c.label}</span>
            {c.unlocked ? (
              <Check className="h-3.5 w-3.5 text-teal-500/80" />
            ) : (
              <span className="text-[10px] text-zinc-600">{c.reason}</span>
            )}
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}
