"use client";

import type { PerformanceDistributionView } from "@/lib/performance/viewModels";
import { Eyebrow, Panel, PanelHeader } from "@/components/console/console-kit";

export function PerformanceDistributionPanel({ data }: { data: PerformanceDistributionView }) {
  return (
    <Panel className="bg-[var(--surface-subdued)]">
      <PanelHeader title="Performance distribution" />
      <p className="text-sm leading-relaxed text-zinc-400">{data.interpretation}</p>

      <div className="mt-4 flex flex-wrap gap-6 text-xs">
        <div>
          <Eyebrow>Easy share</Eyebrow>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-foreground">
            {data.easyPct}%
            <span className="font-normal text-zinc-600"> (target ~{data.easyTarget}%)</span>
          </p>
        </div>
        <div>
          <Eyebrow>Hard runs (14d)</Eyebrow>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-foreground">
            {data.hardRuns14d}
          </p>
        </div>
      </div>

      {data.zones.length > 0 ? (
        <div className="mt-4 space-y-2">
          {data.zones.map((z) => (
            <div key={z.zone} className="flex items-center gap-3">
              <span className="w-8 font-mono text-[10px] font-medium text-zinc-600">{z.zone}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-elevated)] ring-1 ring-[var(--border-subtle)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, z.pct)}%`, background: "var(--home-signal)" }}
                />
              </div>
              <span className="w-10 text-right font-mono text-[10px] tabular-nums text-zinc-500">
                {z.pct}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-600">Import HR data for zone distribution.</p>
      )}

      <ul className="mt-4 space-y-1 border-t border-[var(--border-subtle)] pt-3 text-xs text-zinc-600">
        {data.correlations.map((c, i) => (
          <li key={i}>· {c}</li>
        ))}
      </ul>
    </Panel>
  );
}
