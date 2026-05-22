"use client";

import Link from "next/link";
import type { ProgressionViewModel } from "@/lib/home/dashboardData";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { TrendChart } from "@/components/home/primitives/sparkline";
import { PrProgressionChart } from "@/components/progression/pr-progression-chart";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import type { PrTimelinePoint } from "@/lib/analytics/progression";

function TrendBlock({
  chart,
}: {
  chart: ProgressionViewModel["trends"]["efficiency"];
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={dash.label}>{chart.label}</span>
        {chart.caption ? (
          <span className="text-[10px] tabular-nums text-teal-400/80">
            {chart.caption}
          </span>
        ) : null}
      </div>
      <TrendChart
        data={chart.data}
        positive={chart.positive}
        height={44}
        className="mt-2"
      />
    </div>
  );
}

export function PerformanceTrajectoryPanel({
  data,
  prTimeline,
}: {
  data: ProgressionViewModel;
  prTimeline: PrTimelinePoint[];
}) {
  return (
    <PanelChrome title="Performance trajectory intelligence" accent elevated>
      <p className={cn(dash.muted, "mb-4 max-w-3xl leading-relaxed")}>
        {data.trajectory}
      </p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:gap-6">
        <div className="space-y-4">
          <div>
            <h4 className={dash.label}>Recent milestones</h4>
            <ul className="mt-2 space-y-0 border-l border-teal-500/20 pl-3">
              {data.achievements.length > 0 ? (
                data.achievements.map((a, i) => (
                  <li
                    key={a.id}
                    className={cn(
                      "flex items-start gap-2 py-2.5",
                      i < data.achievements.length - 1 &&
                        "border-b border-white/[0.04]"
                    )}
                  >
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-teal-400/70" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-200">
                        {a.title}
                      </span>
                      <span className={dash.muted}>{a.meta}</span>
                    </span>
                  </li>
                ))
              ) : (
                <li className="py-2 text-xs text-zinc-500">
                  No PR milestones yet — keep building aerobic volume.
                </li>
              )}
            </ul>
          </div>

          {data.milestones.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.milestones.map((m) => (
                <span
                  key={m.id}
                  className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-400 ring-1 ring-inset ring-white/[0.05]"
                >
                  {m.title}
                </span>
              ))}
            </div>
          ) : null}

          {data.bestBlock ? (
            <div className="rounded-lg border border-teal-500/15 bg-teal-500/[0.05] px-3 py-2.5">
              <p className={dash.label}>Best block</p>
              <p className="mt-1 text-sm text-zinc-300">{data.bestBlock}</p>
            </div>
          ) : null}

          {data.comparisons.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {data.comparisons.map((c) => (
                <span
                  key={c.label}
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    c.positive === true && "text-teal-400/90",
                    c.positive === false && "text-amber-400/90",
                    c.positive === null && "text-zinc-500"
                  )}
                >
                  {c.label} {c.value}
                </span>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg bg-white/[0.02] px-2 py-2 ring-1 ring-inset ring-white/[0.04]">
            <p className={cn(dash.label, "px-1 pb-2")}>PR progression feed</p>
            <PrProgressionChart timeline={prTimeline} />
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-b from-teal-500/[0.08] via-transparent to-transparent p-3 sm:p-4">
          <h4 className={cn(dash.label, "mb-3")}>Momentum telemetry</h4>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TrendBlock chart={data.trends.efficiency} />
            <TrendBlock chart={data.trends.pace} />
            <TrendBlock chart={data.trends.volume} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-600">
        <Link href="/records" className="text-teal-400/90 hover:text-teal-300">
          Full records table →
        </Link>
      </p>
    </PanelChrome>
  );
}
