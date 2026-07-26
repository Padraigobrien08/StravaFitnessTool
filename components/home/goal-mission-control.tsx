"use client";

import Link from "next/link";
import type { GoalMissionViewModel } from "@/lib/home/dashboardData";
import { DashboardPanel } from "./primitives/dashboard-panel";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { AnimatedMetric } from "./primitives/animated-metric";
import { dash } from "./primitives/tokens";
import { cn } from "@/lib/utils";

const segmentColors: Record<string, string> = {
  endurance: "bg-blue-400/90",
  pacing: "bg-accent/90",
  consistency: "bg-accent/90",
  freshness: "bg-violet-400/90",
};

export function GoalMissionControl({ goal }: { goal: GoalMissionViewModel }) {
  return (
    <DashboardPanel padding="rail" hover={false}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={dash.labelAccent}>Mission readiness</span>
        <ConfidenceBadge level={goal.confidence} />
      </div>

      <div className="flex flex-wrap items-center gap-4 lg:flex-nowrap lg:gap-6">
        {goal.daysOut != null ? (
          <div
            className="flex shrink-0 items-baseline gap-1.5 border-r border-white/[0.06] pr-4"
            aria-label={`${goal.daysOut} days to race`}
          >
            <AnimatedMetric
              value={goal.daysOut}
              className="font-display text-2xl font-bold text-white"
            />
            <span className={dash.label}>days out</span>
          </div>
        ) : null}

        <div className="flex min-w-[150px] flex-1 items-center gap-3">
          <div className="text-center">
            <AnimatedMetric
              value={goal.score}
              className="font-display text-2xl font-bold text-white"
            />
            <span className="text-xs text-zinc-600"> / 100</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200">{goal.label}</p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
              role="progressbar"
              aria-valuenow={goal.score}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-accent to-accent transition-all duration-500",
                  goal.score < 50 && "from-amber-500 to-amber-600",
                  goal.score < 35 && "from-red-500 to-red-600",
                )}
                style={{ width: `${goal.score}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-500">
              {goal.targetFinish ? (
                <span>
                  Target <span className="text-zinc-300">{goal.targetFinish}</span>
                </span>
              ) : null}
              {goal.probability ? <span className="text-accent/80">{goal.probability}</span> : null}
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          {goal.segments.map((s) => (
            <div key={s.id}>
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>{s.label}</span>
                <span className="tabular-nums text-zinc-400">{s.score}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    segmentColors[s.id] ?? "bg-zinc-500",
                  )}
                  style={{ width: `${s.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <Link
          href={goal.href}
          className="shrink-0 text-[11px] font-medium text-accent/90 hover:text-accent"
        >
          Mission control →
        </Link>
      </div>
    </DashboardPanel>
  );
}
