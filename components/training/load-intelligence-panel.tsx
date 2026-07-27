"use client";

import { LoadIntelligenceChart } from "./charts/load-intelligence-chart";
import type { LoadIntelligenceView } from "@/lib/training/viewModels";
import { Panel, PanelHeader, Readout } from "@/components/console/console-kit";
import { cn } from "@/lib/utils";

const labelColor: Record<string, string> = {
  Fresh: "text-accent",
  Neutral: "text-zinc-300",
  Fatigued: "text-amber-400",
};

const chipStyles: Record<string, string> = {
  Fresh: "bg-accent/10 text-accent ring-accent/25",
  Neutral: "bg-white/[0.04] text-zinc-400 ring-white/10",
  "Accumulating fatigue": "bg-amber-500/10 text-amber-300/90 ring-amber-500/20",
  "Recovery trend": "bg-accent/[0.08] text-accent/80 ring-accent/20",
  "High adaptation window": "bg-blue-500/10 text-blue-300/80 ring-blue-500/15",
};

export function LoadIntelligencePanel({
  data,
  className,
}: {
  data: LoadIntelligenceView;
  className?: string;
}) {
  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader title="Training load intelligence" href="/performance" action="Performance" />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Freshness
          </p>
          <Readout
            value={data.freshness}
            unit="/ 100"
            className="mt-0.5 text-[clamp(30px,5vw,40px)]"
          />
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              labelColor[data.freshnessLabel] ?? "text-zinc-400",
            )}
          >
            {data.freshnessLabel}
          </p>
        </div>
        <dl className="flex gap-6 font-mono text-xs tabular-nums text-zinc-500">
          <div>
            <dt className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">CTL</dt>
            <dd className="mt-0.5 text-[15px] font-semibold text-zinc-300">{data.ctl}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">ATL</dt>
            <dd className="mt-0.5 text-[15px] font-semibold text-zinc-300">{data.atl}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">TSB</dt>
            <dd
              className={cn(
                "mt-0.5 text-[15px] font-semibold",
                data.tsb >= 0 ? "text-accent" : "text-amber-400/90",
              )}
            >
              {data.tsb > 0 ? "+" : ""}
              {data.tsb}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.stateChips.map((chip) => (
          <span
            key={chip}
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
              chipStyles[chip] ?? chipStyles.Neutral,
            )}
          >
            {chip}
          </span>
        ))}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{data.interpretation}</p>
      <p className="mt-2 text-xs text-accent/80">{data.trendNote}</p>

      <div className="mt-4 rounded-lg bg-[var(--surface-subdued)] px-2 py-2 ring-1 ring-inset ring-[var(--border-subtle)]">
        <div className="overflow-x-auto">
          <LoadIntelligenceChart data={data.chartData} currentIndex={data.currentIndex} />
        </div>
        <p className="px-2 pb-1 text-[10px] text-zinc-600">
          Accent = chronic fitness · Amber = recent fatigue · dots = current week
        </p>
      </div>

      <p className="mt-3 text-xs text-zinc-600">
        {data.restDays} day{data.restDays === 1 ? "" : "s"} since last run
      </p>
    </Panel>
  );
}
