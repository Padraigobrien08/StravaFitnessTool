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

export function ExecutionAnalysisPanel({
  data,
}: {
  data: ExecutionAnalysisView;
}) {
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

      <p className="mb-4 text-sm text-zinc-400">{data.fatigueInterpretation}</p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {data.insights.map((ins, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border border-white/[0.04] border-l-[3px] bg-white/[0.02] px-3.5 py-3",
              toneBorder[ins.tone]
            )}
          >
            <h4 className="text-sm font-semibold text-zinc-200">{ins.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {ins.body}
            </p>
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}
