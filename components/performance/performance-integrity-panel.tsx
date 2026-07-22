"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import type { PerformanceIntegrityView } from "@/lib/performance/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

export function PerformanceIntegrityPanel({ data }: { data: PerformanceIntegrityView }) {
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className={dash.labelAccent}>Confidence & data integrity</span>
        <div className="flex gap-2">
          <ConfidenceBadge level={data.overallConfidence} />
          <span className="text-[10px] text-zinc-600">
            Predictions: {data.predictionConfidence}
          </span>
        </div>
      </div>
      <DashboardPanel padding="compact" subdued>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className={dash.label}>Based on</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              {data.basedOn.map((line, i) => (
                <li key={i}>· {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className={dash.label}>Missing / gaps</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-600">
              {data.missing.map((line, i) => (
                <li key={i}>· {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className={dash.label}>Limitations</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-600">
              {data.limitations.map((line, i) => (
                <li key={i}>· {line}</li>
              ))}
            </ul>
          </div>
        </div>

        {data.fieldCoverage.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.04] pt-4">
            {data.fieldCoverage.map((f) => (
              <div
                key={f.label}
                className="rounded-md bg-white/[0.03] px-2.5 py-1.5 text-[10px] ring-1 ring-inset ring-white/[0.05]"
              >
                <span className="text-zinc-500">{f.label}</span>
                <span
                  className={cn(
                    "ml-1.5 font-medium tabular-nums",
                    f.level === "high" && "text-teal-400/80",
                    f.level === "medium" && "text-zinc-400",
                    f.level === "low" && "text-amber-400/80",
                  )}
                >
                  {f.pct}%
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </DashboardPanel>
    </section>
  );
}
