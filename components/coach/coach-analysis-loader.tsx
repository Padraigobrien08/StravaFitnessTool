"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOADING_PHASES, loadingMessageForTool } from "@/lib/coach/toolLabels";
import { cn } from "@/lib/utils";

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
    }, 2200);
    return () => clearInterval(id);
  }, [phases.length]);

  const toolLabel =
    activeTools && activeTools.length > 0
      ? activeTools
          .slice(0, 2)
          .map((t) => t.replace(/^get_/, "").replace(/_/g, " "))
          .join(", ")
      : null;

  return (
    <div className="coach-analysis-loader space-y-2">
      <p
        key={phaseIndex}
        className={cn(
          "text-[14px] text-zinc-500 coach-phase-enter coach-stream-pulse"
        )}
      >
        {phases[phaseIndex]}
      </p>
      {toolLabel ? (
        <p className="text-[11px] text-zinc-600">
          Using {toolLabel}
        </p>
      ) : null}
    </div>
  );
}
