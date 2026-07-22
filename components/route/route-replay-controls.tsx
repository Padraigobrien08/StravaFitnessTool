"use client";

import { REPLAY_SPEEDS, formatReplayClock } from "@/lib/route-intelligence/replay";
import type { ReplayState } from "@/lib/route-intelligence/types";
import { cn } from "@/lib/utils";
import { Pause, Play, RotateCcw } from "lucide-react";

export function RouteReplayControls({
  state,
  onTogglePlay,
  onRestart,
  onSpeed,
}: {
  state: ReplayState;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSpeed: (speed: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25 transition-colors hover:bg-teal-500/25"
        aria-label={state.playing ? "Pause" : "Play"}
      >
        {state.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <button
        type="button"
        onClick={onRestart}
        className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        aria-label="Restart"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <span className="font-display text-sm font-semibold tabular-nums text-white">
        {formatReplayClock(state.currentSec)}
        <span className="text-zinc-600"> / {formatReplayClock(state.durationSec)}</span>
      </span>
      <div className="ml-auto flex gap-1">
        {REPLAY_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeed(s)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium tabular-nums transition-colors",
              state.speed === s
                ? "bg-teal-500/20 text-teal-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
