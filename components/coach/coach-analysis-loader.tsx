"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOADING_PHASES, loadingMessageForTool } from "@/lib/coach/toolLabels";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function CoachAnalysisLoader({
  activeTools,
}: {
  activeTools?: string[];
}) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  const phases =
    activeTools && activeTools.length > 0
      ? activeTools.map(loadingMessageForTool)
      : DEFAULT_LOADING_PHASES;

  useEffect(() => {
    const id = setInterval(() => {
      setPhaseIndex((i) => (i + 1) % phases.length);
    }, 1400);
    return () => clearInterval(id);
  }, [phases.length]);

  return (
    <div className="coach-intel-card rounded-xl border border-white/[0.06] bg-[#0c0d10]/90 p-4">
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-teal-500/10" />
          <Loader2 className="relative h-4 w-4 animate-spin text-teal-400/80" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-300">Analyzing</p>
          <p
            key={phaseIndex}
            className={cn(
              "text-xs text-zinc-500 coach-phase-enter"
            )}
          >
            {phases[phaseIndex]}
          </p>
        </div>
      </div>
      <div className="coach-shimmer mt-4 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div className="coach-shimmer-bar h-full w-1/3 rounded-full bg-teal-500/40" />
      </div>
    </div>
  );
}
