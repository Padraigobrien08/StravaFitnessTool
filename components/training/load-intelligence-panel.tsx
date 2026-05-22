"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { LoadIntelligenceChart } from "./charts/load-intelligence-chart";
import type { LoadIntelligenceView } from "@/lib/training/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const labelColor: Record<string, string> = {
  Fresh: "text-teal-400",
  Neutral: "text-zinc-300",
  Fatigued: "text-amber-400",
};

const chipStyles: Record<string, string> = {
  Fresh: "bg-teal-500/10 text-teal-300/90 ring-teal-500/20",
  Neutral: "bg-white/[0.04] text-zinc-400 ring-white/10",
  "Accumulating fatigue": "bg-amber-500/10 text-amber-300/90 ring-amber-500/20",
  "Recovery trend": "bg-teal-500/8 text-teal-400/80 ring-teal-500/15",
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
    <PanelChrome
      title="Training load intelligence"
      href="/performance"
      elevated
      className={className}
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.04] pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Freshness
          </p>
          <p className="font-display text-3xl font-bold tabular-nums text-white sm:text-4xl">
            {data.freshness}
            <span className="text-lg font-normal text-zinc-600"> / 100</span>
          </p>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              labelColor[data.freshnessLabel] ?? "text-zinc-400"
            )}
          >
            {data.freshnessLabel}
          </p>
        </div>
        <dl className="flex gap-6 text-xs tabular-nums text-zinc-500">
          <div>
            <dt className={dash.label}>CTL</dt>
            <dd className="mt-0.5 font-semibold text-zinc-300">{data.ctl}</dd>
          </div>
          <div>
            <dt className={dash.label}>ATL</dt>
            <dd className="mt-0.5 font-semibold text-zinc-300">{data.atl}</dd>
          </div>
          <div>
            <dt className={dash.label}>TSB</dt>
            <dd
              className={cn(
                "mt-0.5 font-semibold",
                data.tsb >= 0 ? "text-teal-400/90" : "text-amber-400/90"
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
              chipStyles[chip] ?? chipStyles.Neutral
            )}
          >
            {chip}
          </span>
        ))}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {data.interpretation}
      </p>
      <p className="mt-2 text-xs text-teal-400/75">{data.trendNote}</p>

      <div className="mt-4 rounded-lg bg-white/[0.02] px-2 py-2 ring-1 ring-inset ring-white/[0.04]">
        <LoadIntelligenceChart
          data={data.chartData}
          currentIndex={data.currentIndex}
        />
        <p className="px-2 pb-1 text-[10px] text-zinc-600">
          Teal = chronic fitness · Amber = recent fatigue · dots = current week
        </p>
      </div>

      <p className="mt-3 text-xs text-zinc-600">
        {data.restDays} day{data.restDays === 1 ? "" : "s"} since last run
      </p>
    </PanelChrome>
  );
}
