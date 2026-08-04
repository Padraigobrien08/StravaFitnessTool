"use client";

import type { ProgressionViewModel } from "@/lib/home/dashboardData";
import { TrendChart } from "@/components/home/primitives/sparkline";
import { PrProgressionChart } from "@/components/progression/pr-progression-chart";
import { Eyebrow, Panel, PanelHeader } from "@/components/console/console-kit";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import type { PrTimelinePoint } from "@/lib/analytics/progression";

function TrendBlock({ chart }: { chart: ProgressionViewModel["trends"]["efficiency"] }) {
  return (
    <div className="rounded-lg bg-[var(--surface-subdued)] px-3 py-3 ring-1 ring-inset ring-[var(--border-subtle)]">
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>{chart.label}</Eyebrow>
        {chart.caption ? (
          <span className="font-mono text-[10px] tabular-nums text-accent">{chart.caption}</span>
        ) : null}
      </div>
      <TrendChart data={chart.data} positive={chart.positive} height={44} className="mt-2" />
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
    <Panel>
      <PanelHeader title="Performance trajectory intelligence" />
      <p className={cn(dash.muted, "mb-4 max-w-3xl leading-relaxed")}>{data.trajectory}</p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:gap-6">
        <div className="space-y-4">
          <div>
            <Eyebrow>Recent milestones</Eyebrow>
            <ul className="mt-2 space-y-0 border-l border-accent/25 pl-3">
              {data.achievements.length > 0 ? (
                data.achievements.map((a, i) => (
                  <li
                    key={a.id}
                    className={cn(
                      "flex items-start gap-2 py-2.5",
                      i < data.achievements.length - 1 && "border-b border-[var(--border-subtle)]",
                    )}
                  >
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-200">{a.title}</span>
                      <span className={dash.muted}>{a.meta}</span>
                    </span>
                  </li>
                ))
              ) : (
                <li className="py-2 text-xs text-zinc-500">
                  No PR milestones yet. Keep building aerobic volume.
                </li>
              )}
            </ul>
          </div>

          {data.milestones.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.milestones.map((m) => (
                <span
                  key={m.id}
                  className="rounded-lg bg-[var(--surface-subdued)] px-2.5 py-1.5 text-xs text-zinc-400 ring-1 ring-inset ring-[var(--border-subtle)]"
                >
                  {m.title}
                </span>
              ))}
            </div>
          ) : null}

          {data.bestBlock ? (
            <div
              className="rounded-lg px-3 py-2.5"
              style={{
                background: "var(--home-signal-wash)",
                boxShadow: "inset 0 0 0 1px var(--home-signal-line)",
              }}
            >
              <Eyebrow>Best block</Eyebrow>
              <p className="mt-1 text-sm text-zinc-300">{data.bestBlock}</p>
            </div>
          ) : null}

          {data.comparisons.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {data.comparisons.map((c) => (
                <span
                  key={c.label}
                  className={cn(
                    "font-mono text-xs font-medium tabular-nums",
                    c.positive === true && "text-accent",
                    c.positive === false && "text-amber-400/90",
                    c.positive === null && "text-zinc-500",
                  )}
                >
                  {c.label} {c.value}
                </span>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg bg-[var(--surface-subdued)] px-2 py-2 ring-1 ring-inset ring-[var(--border-subtle)]">
            <Eyebrow className="px-1 pb-2">PR progression feed</Eyebrow>
            <PrProgressionChart timeline={prTimeline} />
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-b from-accent/[0.08] via-transparent to-transparent p-3 sm:p-4">
          <Eyebrow className="mb-3">Momentum telemetry</Eyebrow>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TrendBlock chart={data.trends.efficiency} />
            <TrendBlock chart={data.trends.pace} />
            <TrendBlock chart={data.trends.volume} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
