"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { TrainingDistributionView } from "@/lib/runs/viewModels";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import type { WorkoutType } from "@/lib/analytics/workoutType";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const barColors: Record<WorkoutType, string> = {
  easy: "bg-teal-500/60",
  recovery: "bg-zinc-500/50",
  long: "bg-blue-500/55",
  tempo: "bg-amber-500/55",
  interval: "bg-amber-400/70",
  race: "bg-fuchsia-500/50",
  unknown: "bg-white/20",
};

export function TrainingDistributionSummary({
  data,
}: {
  data: TrainingDistributionView;
}) {
  return (
    <PanelChrome title="Training distribution" subdued>
      <p className={cn(dash.muted, "mb-4")}>
        What kind of training behavior is emerging in your recent block.
      </p>

      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
        {data.mix.map((m) => (
          <div
            key={m.type}
            className={cn(barColors[m.type], "transition-all")}
            style={{ width: `${Math.max(m.pct, 2)}%` }}
            title={`${m.label} ${m.pct}%`}
          />
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1">
        {data.mix.map((m) => (
          <span key={m.type} className="text-[10px] text-zinc-500">
            <span
              className={cn(
                "mr-1 inline-block h-2 w-2 rounded-sm",
                barColors[m.type]
              )}
            />
            {WORKOUT_TYPE_LABELS[m.type]} {m.pct}% ({m.runCount})
          </span>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.widgets.map((w) => (
          <div
            key={w.label}
            className="rounded-lg bg-white/[0.02] px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]"
          >
            <p className={dash.label}>{w.label}</p>
            <p className="mt-0.5 font-display text-lg font-semibold text-zinc-200">
              {w.value}
            </p>
            {w.hint ? <p className="text-[10px] text-zinc-600">{w.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/[0.04] pt-3 text-xs text-zinc-500">
        <span>{data.easyHardLabel}</span>
        <span>{data.longRunFreq}</span>
        <span>{data.intervalDensity}</span>
      </div>
    </PanelChrome>
  );
}
