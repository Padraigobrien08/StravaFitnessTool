"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { PatternInsightView } from "@/lib/runs/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const toneStyles = {
  positive: "border-l-teal-500/40",
  neutral: "border-l-zinc-500/30",
  warning: "border-l-amber-500/45",
};

export function WorkoutPatternAnalysis({
  patterns,
}: {
  patterns: PatternInsightView[];
}) {
  return (
    <PanelChrome title="Workout pattern analysis">
      <p className={`${dash.muted} mb-4 max-w-2xl`}>
        Training structure narrative from session mix, intensity, and progression
        signals.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {patterns.map((p, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border border-white/[0.04] border-l-[3px] bg-white/[0.02] px-4 py-3",
              toneStyles[p.tone]
            )}
          >
            <h4 className="text-sm font-semibold text-zinc-200">{p.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{p.body}</p>
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}
