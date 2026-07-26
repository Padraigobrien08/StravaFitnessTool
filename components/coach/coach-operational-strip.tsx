"use client";

import type { CoachContextSnapshot } from "@/lib/coach/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Gauge, Layers, Target, TrendingUp } from "lucide-react";

const adaptColors = {
  improving: "text-accent",
  stable: "text-zinc-400",
  strained: "text-amber-400",
  unknown: "text-zinc-600",
};

const riskColors = {
  low: "border-accent/20 text-accent/90",
  moderate: "border-amber-500/25 text-amber-200/90",
  elevated: "border-red-500/25 text-red-300/90",
};

export function CoachOperationalStrip({ snapshot }: { snapshot: CoachContextSnapshot }) {
  return (
    <div className="coach-ops-strip shrink-0 border-b border-white/[0.05] bg-[#08090c]/90 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/50 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span className="truncate font-medium text-zinc-300">{snapshot.currentFocus}</span>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded border px-2 py-0.5",
            adaptColors[snapshot.adaptationTrend],
          )}
        >
          <TrendingUp className="h-3 w-3" />
          {snapshot.adaptationLabel}
        </span>

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded border px-2 py-0.5",
            riskColors[snapshot.riskLevel],
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          {snapshot.riskLabel}
        </span>

        {snapshot.readinessScore != null ? (
          <span className="inline-flex items-center gap-1 text-zinc-500">
            <Gauge className="h-3 w-3 text-zinc-600" />
            Readiness {snapshot.readinessScore}
            {snapshot.readinessLabel ? ` · ${snapshot.readinessLabel}` : ""}
          </span>
        ) : null}

        {snapshot.raceLabel ? (
          <span className="inline-flex items-center gap-1 text-zinc-500">
            <Target className="h-3 w-3 text-accent/60" />
            {snapshot.raceLabel}
            {snapshot.daysToRace != null ? ` · ${snapshot.daysToRace}d` : ""}
          </span>
        ) : null}

        {snapshot.archetypeLabel ? (
          <span className="hidden items-center gap-1 text-zinc-600 sm:inline-flex">
            <Layers className="h-3 w-3" />
            {snapshot.archetypeLabel}
          </span>
        ) : null}

        <span className="ml-auto capitalize text-zinc-600">
          {snapshot.recommendationConfidence} confidence
        </span>
      </div>
    </div>
  );
}
