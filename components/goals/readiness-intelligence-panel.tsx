"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { ReadinessDimensionView } from "@/lib/goals/viewModels";
import type { RaceReadiness } from "@/lib/analytics/readiness";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const levelColor = {
  strong: "bg-accent/50",
  moderate: "bg-amber-500/45",
  weak: "bg-red-500/40",
};

export function ReadinessIntelligencePanel({
  dimensions,
  readiness,
}: {
  dimensions: ReadinessDimensionView[];
  readiness: RaceReadiness | null;
}) {
  return (
    <PanelChrome title="Readiness breakdown" accent elevated>
      {readiness ? (
        <p className={`${dash.muted} mb-4`}>
          {readiness.probabilityBand} · {readiness.score}/100 overall
        </p>
      ) : (
        <p className={`${dash.muted} mb-4`}>
          General half-marathon readiness — set a race goal for distance-specific scoring.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dimensions.map((d) => (
          <div key={d.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-300">{d.label}</span>
              <span className="text-xs capitalize text-zinc-600">{d.level}</span>
            </div>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-zinc-100">
              {d.score}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn("h-full rounded-full", levelColor[d.level])}
                style={{ width: `${d.score}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-zinc-600">{d.note}</p>
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}
