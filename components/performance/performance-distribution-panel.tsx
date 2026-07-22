"use client";

import Link from "next/link";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { PerformanceDistributionView } from "@/lib/performance/viewModels";
import { dash } from "@/components/home/primitives/tokens";

export function PerformanceDistributionPanel({ data }: { data: PerformanceDistributionView }) {
  return (
    <PanelChrome title="Performance distribution" href="/effort" subdued>
      <p className="text-sm leading-relaxed text-zinc-400">{data.interpretation}</p>

      <div className="mt-4 flex flex-wrap gap-6 text-xs">
        <div>
          <p className={dash.label}>Easy share</p>
          <p className="mt-0.5 font-semibold text-zinc-200">
            {data.easyPct}%
            <span className="font-normal text-zinc-600"> (target ~{data.easyTarget}%)</span>
          </p>
        </div>
        <div>
          <p className={dash.label}>Hard runs (14d)</p>
          <p className="mt-0.5 font-semibold text-zinc-200">{data.hardRuns14d}</p>
        </div>
      </div>

      {data.zones.length > 0 ? (
        <div className="mt-4 space-y-2">
          {data.zones.map((z) => (
            <div key={z.zone} className="flex items-center gap-3">
              <span className="w-8 text-[10px] font-medium text-zinc-600">{z.zone}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-teal-500/50"
                  style={{ width: `${Math.min(100, z.pct)}%` }}
                />
              </div>
              <span className="w-10 text-right text-[10px] tabular-nums text-zinc-500">
                {z.pct}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-600">Import HR data for zone distribution.</p>
      )}

      <ul className="mt-4 space-y-1 border-t border-white/[0.04] pt-3 text-xs text-zinc-600">
        {data.correlations.map((c, i) => (
          <li key={i}>· {c}</li>
        ))}
      </ul>

      <p className="mt-3 text-xs">
        <Link href="/effort" className="text-teal-400/90 hover:text-teal-300">
          Full effort advisor →
        </Link>
      </p>
    </PanelChrome>
  );
}
