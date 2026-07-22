"use client";

import { useState } from "react";
import Link from "next/link";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { PredictionChart } from "@/components/predictions/prediction-chart";
import { PredictionTrendChart } from "@/components/progression/prediction-trend-chart";
import type { RaceProjectionView } from "@/lib/performance/viewModels";
import type { PredictionTimelinePoint } from "@/lib/analytics/progression";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { ChevronDown, AlertTriangle } from "lucide-react";

export function RaceProjectionPanel({
  projection,
  predictionTimeline,
}: {
  projection: RaceProjectionView;
  predictionTimeline: PredictionTimelinePoint[];
}) {
  const [curveOpen, setCurveOpen] = useState(false);

  if (!projection.primary && projection.allDistances.length === 0) {
    return (
      <PanelChrome title="Race performance projection" accent elevated>
        <p className="text-sm text-zinc-500">
          Need quality efforts between 4–15 km (or FIT segment data) to build evidence-based
          projections.{" "}
          <Link href="/import" className="text-teal-400 hover:underline">
            Import FIT files
          </Link>{" "}
          for best results.
        </p>
      </PanelChrome>
    );
  }

  const p = projection.primary!;

  return (
    <PanelChrome title="Race performance projection" href="/goals" accent elevated>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(200px,280px)] lg:gap-8">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={dash.label}>{p.label} projection</p>
              <p className="font-display text-3xl font-bold tabular-nums text-white sm:text-4xl">
                {p.timeDisplay}
                <span className="ml-2 text-lg font-normal text-zinc-500">{p.spreadDisplay}</span>
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Evidence band {p.rangeDisplay} · {p.paceDisplay} even effort
              </p>
            </div>
            <ConfidenceBadge level={p.confidence} />
          </div>

          <p className="mt-3 text-xs text-zinc-600">
            Estimate — not a guarantee. Spread reflects model disagreement and sample size.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className={dash.label}>Confidence drivers</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                {projection.confidenceDrivers.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-teal-500/60">✓</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={dash.label}>Confidence reducers</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                {projection.confidenceReducers.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span>○</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {projection.pacingNote ? (
            <p className="mt-4 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-sm text-zinc-400">
              <span className="font-medium text-zinc-300">Pacing · </span>
              {projection.pacingNote}
            </p>
          ) : null}

          {projection.fadeRisk ? (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-400/90">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {projection.fadeRisk}
            </p>
          ) : null}

          <ul className="mt-4 space-y-1 text-xs text-zinc-600">
            {projection.explanation.slice(0, 3).map((line, i) => (
              <li key={i}>· {line}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <p className={dash.label}>All distances</p>
          <div className="space-y-2">
            {projection.allDistances.map((d) => (
              <div
                key={d.label}
                className="flex items-baseline justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-inset ring-white/[0.05]"
              >
                <span className="text-xs text-zinc-500">{d.label}</span>
                <span className="text-sm font-semibold tabular-nums text-zinc-200">
                  {d.timeDisplay}
                  {d.rangeDisplay ? (
                    <span className="ml-1 text-[10px] font-normal text-zinc-600">
                      {d.rangeDisplay}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {predictionTimeline.length >= 2 ? (
        <div className="mt-5 rounded-lg bg-white/[0.02] px-2 py-3 ring-1 ring-inset ring-white/[0.04]">
          <p className={cn(dash.label, "px-1 mb-2")}>Projection trajectory</p>
          <PredictionTrendChart timeline={predictionTimeline} />
        </div>
      ) : null}

      <button
        type="button"
        className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hover:bg-white/[0.04]"
        onClick={() => setCurveOpen((v) => !v)}
        aria-expanded={curveOpen}
      >
        Performance curve & model scatter
        <ChevronDown className={cn("h-4 w-4 transition-transform", curveOpen && "rotate-180")} />
      </button>
      {curveOpen ? (
        <div className="mt-3 rounded-lg bg-white/[0.02] p-2 ring-1 ring-inset ring-white/[0.04]">
          <PredictionChart analysis={projection.analysis} />
        </div>
      ) : null}
    </PanelChrome>
  );
}
