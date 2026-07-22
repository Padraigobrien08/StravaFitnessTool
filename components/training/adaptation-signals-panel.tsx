"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { EfficiencySignalChart } from "./charts/efficiency-signal-chart";
import type { AdaptationSignalView } from "@/lib/training/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export function AdaptationSignalsPanel({ data }: { data: AdaptationSignalView }) {
  const TrendIcon =
    data.trend === "improving" ? TrendingUp : data.trend === "declining" ? TrendingDown : Minus;

  return (
    <PanelChrome title="Adaptation signals" href="/performance" accent>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-zinc-50">{data.headline}</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
                data.trend === "improving"
                  ? "bg-teal-500/10 text-teal-300 ring-teal-500/20"
                  : data.trend === "declining"
                    ? "bg-amber-500/10 text-amber-300 ring-amber-500/20"
                    : "bg-white/[0.04] text-zinc-500 ring-white/10",
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {data.trendLabel}
            </span>
            <ConfidenceBadge level={data.confidence} />
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {data.interpretation}
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            {data.deltaPct !== null ? (
              <div>
                <p className={dash.label}>Period delta</p>
                <p
                  className={cn(
                    "mt-0.5 font-semibold tabular-nums",
                    data.deltaPct > 0 ? "text-teal-400" : "text-amber-400",
                  )}
                >
                  {data.deltaPct > 0 ? "+" : ""}
                  {data.deltaPct}% vs prior month
                </p>
                <p className="text-zinc-600">Lower index = faster at same HR</p>
              </div>
            ) : null}
            {data.comparablePeriod ? (
              <div>
                <p className={dash.label}>Comparable window</p>
                <p className="mt-0.5 text-zinc-400">{data.comparablePeriod}</p>
              </div>
            ) : null}
          </div>

          <ul className="mt-4 space-y-1 text-xs text-zinc-600">
            {data.evidence.map((e, i) => (
              <li key={i}>· {e}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-white/[0.02] px-2 py-2 ring-1 ring-inset ring-white/[0.04]">
          <p className={cn(dash.label, "px-1 pb-1")}>Supporting trend</p>
          <EfficiencySignalChart data={data.chartData} positive={data.trend !== "declining"} />
        </div>
      </div>
    </PanelChrome>
  );
}
