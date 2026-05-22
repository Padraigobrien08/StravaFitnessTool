"use client";

import { DEFAULT_LOADING_PHASES, loadingMessageForTool } from "@/lib/coach/toolLabels";
import { cn } from "@/lib/utils";

export function CoachReasoningTrace({
  phase,
  activeTools,
}: {
  phase: number;
  activeTools?: string[];
}) {
  const phases =
    activeTools && activeTools.length > 0
      ? activeTools.map(loadingMessageForTool)
      : DEFAULT_LOADING_PHASES;

  const label = phases[phase % phases.length];

  return (
    <div className="coach-reasoning-trace rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
        Reasoning trace
      </p>
      <p
        key={label}
        className={cn("mt-1 text-[11px] text-zinc-500 coach-phase-enter")}
      >
        {label}
      </p>
      <p className="mt-1 text-[10px] text-zinc-700">
        Grounded in readiness, fatigue, pacing, and historical adaptation models
      </p>
    </div>
  );
}
