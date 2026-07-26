"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { EfficiencySignalChart } from "./charts/efficiency-signal-chart";
import type { AdaptationSignalView } from "@/lib/training/viewModels";
import { Eyebrow, Panel, PanelHeader } from "@/components/console/console-kit";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export function AdaptationSignalsPanel({ data }: { data: AdaptationSignalView }) {
  const TrendIcon =
    data.trend === "improving" ? TrendingUp : data.trend === "declining" ? TrendingDown : Minus;

  return (
    <Panel>
      <PanelHeader title="Adaptation signals" href="/performance" action="Performance" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-foreground">{data.headline}</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
                data.trend === "improving"
                  ? "bg-accent/10 text-accent ring-accent/25"
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

          <div className="mt-4 flex flex-wrap gap-6 text-xs">
            {data.deltaPct !== null ? (
              <div>
                <Eyebrow>Period delta</Eyebrow>
                <p
                  className={cn(
                    "mt-0.5 font-mono text-[15px] font-semibold tabular-nums",
                    data.deltaPct > 0 ? "text-accent" : "text-amber-400",
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
                <Eyebrow>Comparable window</Eyebrow>
                <p className="mt-0.5 font-mono text-[13px] tabular-nums text-zinc-400">
                  {data.comparablePeriod}
                </p>
              </div>
            ) : null}
          </div>

          <ul className="mt-4 space-y-1 text-xs text-zinc-600">
            {data.evidence.map((e, i) => (
              <li key={i}>· {e}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-[var(--surface-subdued)] px-2 py-2 ring-1 ring-inset ring-[var(--border-subtle)]">
          <Eyebrow className="px-1 pb-1">Supporting trend</Eyebrow>
          <div className="overflow-x-auto">
            <EfficiencySignalChart data={data.chartData} positive={data.trend !== "declining"} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
