"use client";

import Link from "next/link";
import type { BurndownMetric, ProgressionBurndown } from "@/lib/analytics/burndown";
import { signalCoachLink } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

const STATUS_STYLE: Record<BurndownMetric["status"], { label: string; cls: string }> = {
  met: { label: "met", cls: "text-[var(--home-good)]" },
  ahead: { label: "ahead", cls: "text-[var(--home-good)]" },
  on_track: { label: "on track", cls: "text-zinc-400" },
  behind: { label: "behind", cls: "text-amber-300/90" },
  stalled: { label: "stalled", cls: "text-amber-300/90" },
};

export function IntelligenceProgressionBurndown({ data }: { data: ProgressionBurndown }) {
  if (!data.available || data.metrics.length === 0) return null;

  return (
    <Panel
      title="Progression burn-down"
      hint={
        <>
          on pace for your {data.goalDistanceLabel}? · targets by {data.deadlineLabel}
        </>
      }
    >
      <p className="mt-1 text-[12px] leading-snug text-zinc-400">{data.headline}</p>

      <div className="mt-2 space-y-2.5">
        {data.metrics.map((m) => (
          <MetricRow key={m.key} metric={m} />
        ))}
      </div>

      {data.limitations.length > 0 ? (
        <p className="mt-2 text-[10px] leading-snug text-zinc-700">{data.limitations[0]}</p>
      ) : null}

      <Link
        href={signalCoachLink("Am I on pace to be ready for my race — long run and volume?")}
        className="mt-2 inline-block text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        Ask Coach
      </Link>
    </Panel>
  );
}

function MetricRow({ metric }: { metric: BurndownMetric }) {
  const style = STATUS_STYLE[metric.status];
  const pct =
    metric.target > 0 ? Math.min(100, Math.round((metric.current / metric.target) * 100)) : 0;
  const barColor =
    metric.status === "behind" || metric.status === "stalled"
      ? "bg-amber-400/70"
      : "bg-[var(--home-good)]";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="text-zinc-400">{metric.label}</span>
        <span className="tabular-nums text-zinc-500">
          <span className="text-zinc-300">{metric.current}</span> / {metric.target} {metric.unit}
          <span className={cn("ml-1.5", style.cls)}>
            {style.label}
            {metric.weeksBehind != null && metric.weeksBehind !== 0
              ? ` ${metric.weeksBehind > 0 ? `${metric.weeksBehind}w` : `${Math.abs(metric.weeksBehind)}w ahead`}`
              : ""}
          </span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] text-zinc-600">
        rising ~{metric.recentRatePerWeek} km/wk · needs ~{metric.neededPerWeek} km/wk
      </p>
    </div>
  );
}
