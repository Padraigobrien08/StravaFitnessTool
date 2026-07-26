"use client";

import { Eyebrow, Panel, Readout } from "@/components/console/console-kit";
import type { ReadinessDimensionView } from "@/lib/goals/viewModels";
import type { RaceReadiness } from "@/lib/analytics/readiness";
import { cn } from "@/lib/utils";

const levelColor = {
  strong: "bg-accent/60",
  moderate: "bg-amber-500/50",
  weak: "bg-red-500/45",
};

export function ReadinessIntelligencePanel({
  dimensions,
  readiness,
}: {
  dimensions: ReadinessDimensionView[];
  readiness: RaceReadiness | null;
}) {
  return (
    <Panel>
      <Eyebrow className="mb-2.5">Readiness breakdown</Eyebrow>
      {readiness ? (
        <p className="mb-4 text-xs text-zinc-500">
          {readiness.probabilityBand} ·{" "}
          <span className="font-mono tabular-nums text-zinc-400">{readiness.score}/100</span>{" "}
          overall
        </p>
      ) : (
        <p className="mb-4 text-xs text-zinc-500">
          General half-marathon readiness — set a race goal for distance-specific scoring.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dimensions.map((d) => (
          <div
            key={d.id}
            className="rounded-xl bg-[var(--surface-subdued)] p-3.5 ring-1 ring-[var(--border-subtle)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-300">{d.label}</span>
              <span className="text-xs capitalize text-zinc-500">{d.level}</span>
            </div>
            <Readout value={d.score} className="mt-1 text-xl" />
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-elevated)] ring-1 ring-[var(--border-subtle)]">
              <div
                className={cn("h-full rounded-full", levelColor[d.level])}
                style={{ width: `${d.score}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-zinc-500">{d.note}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
