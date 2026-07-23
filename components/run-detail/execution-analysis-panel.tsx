"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { ExecutionAnalysisView } from "@/lib/runs/workoutDetailViewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const toneBorder = {
  positive: "border-l-teal-500/40",
  neutral: "border-l-zinc-500/30",
  warning: "border-l-amber-500/45",
};

export function ExecutionAnalysisPanel({ data }: { data: ExecutionAnalysisView }) {
  const hasV2 =
    data.repeatabilityScore != null ||
    data.decouplingPct != null ||
    data.thresholdControlScore != null;
  // Positive decoupling = efficiency dropped (HR crept up); lower is better.
  const decoupTone =
    data.decouplingPct == null
      ? "text-zinc-300"
      : data.decouplingPct <= 5
        ? "text-teal-300/95"
        : data.decouplingPct <= 10
          ? "text-amber-300/90"
          : "text-rose-300/90";

  return (
    <PanelChrome title="Session execution analysis" accent elevated>
      <div className="mb-4 flex flex-wrap gap-6">
        <div>
          <p className={dash.label}>Execution quality</p>
          <p className="font-display text-3xl font-bold tabular-nums text-white">
            {data.qualityScore}
            <span className="text-lg font-normal text-zinc-600"> / 100</span>
          </p>
        </div>
        <div>
          <p className={dash.label}>Pacing stability</p>
          <p className="font-display text-3xl font-bold tabular-nums text-teal-300/95">
            {data.pacingStabilityScore}
            <span className="text-lg font-normal text-zinc-600"> / 100</span>
          </p>
        </div>
      </div>

      {hasV2 ? (
        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-white/[0.02] px-3.5 py-3">
          {data.repeatabilityScore != null ? (
            <div>
              <p className={dash.label}>Interval repeatability</p>
              <p className="text-lg font-semibold tabular-nums text-zinc-200">
                {data.repeatabilityScore}
                <span className="text-xs font-normal text-zinc-600"> / 100</span>
              </p>
            </div>
          ) : null}
          {data.decouplingPct != null ? (
            <div>
              <p className={dash.label}>Aerobic decoupling</p>
              <p className={cn("text-lg font-semibold tabular-nums", decoupTone)}>
                {data.decouplingPct > 0 ? "+" : ""}
                {data.decouplingPct}%
              </p>
            </div>
          ) : null}
          {data.thresholdControlScore != null ? (
            <div>
              <p className={dash.label}>Threshold control</p>
              <p className="text-lg font-semibold tabular-nums text-zinc-200">
                {data.thresholdControlScore}
                <span className="text-xs font-normal text-zinc-600"> / 100</span>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mb-4 text-sm text-zinc-400">{data.fatigueInterpretation}</p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {data.insights.map((ins, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border border-white/[0.04] border-l-[3px] bg-white/[0.02] px-3.5 py-3",
              toneBorder[ins.tone],
            )}
          >
            <h4 className="text-sm font-semibold text-zinc-200">{ins.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{ins.body}</p>
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}
