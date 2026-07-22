"use client";

import type { ProgressionViewModel } from "@/lib/home/dashboardData";
import { PanelChrome } from "./primitives/panel-chrome";
import { TrendChart } from "./primitives/sparkline";
import { dash, ops } from "./primitives/tokens";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

function TrendBlock({
  chart,
  className,
}: {
  chart: ProgressionViewModel["trends"]["efficiency"];
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-3", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={dash.label}>{chart.label}</span>
        {chart.caption ? (
          <span className="text-[10px] tabular-nums text-teal-400/80">{chart.caption}</span>
        ) : null}
      </div>
      <TrendChart data={chart.data} positive={chart.positive} height={44} className="mt-2" />
    </div>
  );
}

export function ProgressionMomentumPanel({ data }: { data: ProgressionViewModel }) {
  return (
    <PanelChrome
      title="Progression & momentum"
      href="/performance"
      elevated
      className={cn(ops.intelSide)}
    >
      <p className={cn(dash.muted, "mb-4 leading-relaxed")}>{data.trajectory}</p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:gap-6">
        <div className="space-y-4">
          <div>
            <h4 className={dash.label}>Achievements</h4>
            <ul className="mt-2 space-y-0 border-l border-teal-500/20 pl-3">
              {data.achievements.length > 0 ? (
                data.achievements.slice(0, 4).map((a, i) => (
                  <li
                    key={a.id}
                    className={cn(
                      "flex items-start gap-2 py-2 transition-colors hover:bg-white/[0.02]",
                      i < Math.min(data.achievements.length, 4) - 1 &&
                        "border-b border-white/[0.04]",
                    )}
                  >
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-teal-400/70" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-200">{a.title}</span>
                      <span className={dash.muted}>{a.meta}</span>
                    </span>
                  </li>
                ))
              ) : (
                <li className="py-2 text-xs text-zinc-500">No recent PRs yet.</li>
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
                  <span className="font-medium text-zinc-300">{m.title}</span>
                  {m.meta ? ` · ${m.meta}` : ""}
                </span>
              ))}
            </div>
          ) : null}

          {data.bestBlock ? (
            <div className="rounded-lg border border-teal-500/15 bg-teal-500/[0.05] px-3 py-2.5">
              <p className={dash.label}>Best block</p>
              <p className="mt-1 text-sm leading-snug text-zinc-300">{data.bestBlock}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-gradient-to-b from-teal-500/[0.1] via-teal-500/[0.02] to-transparent p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className={dash.label}>Momentum telemetry</h4>
            {data.comparisons.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.comparisons.map((c) => (
                  <span
                    key={c.label}
                    className={cn(
                      "text-[11px] font-medium tabular-nums",
                      c.positive === true && "text-teal-400/90",
                      c.positive === false && "text-amber-400/90",
                      c.positive === null && "text-zinc-500",
                    )}
                  >
                    {c.label} {c.value}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <TrendBlock chart={data.trends.efficiency} />
            <TrendBlock chart={data.trends.volume} />
            <TrendBlock chart={data.trends.pace} />
          </div>
        </div>
      </div>
    </PanelChrome>
  );
}
