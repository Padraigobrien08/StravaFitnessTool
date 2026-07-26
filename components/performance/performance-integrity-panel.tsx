"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import type { PerformanceIntegrityView } from "@/lib/performance/viewModels";
import { Eyebrow, Panel } from "@/components/console/console-kit";
import { cn } from "@/lib/utils";

export function PerformanceIntegrityPanel({ data }: { data: PerformanceIntegrityView }) {
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Confidence & data integrity</Eyebrow>
        <div className="flex items-center gap-2">
          <ConfidenceBadge level={data.overallConfidence} />
          <span className="font-mono text-[10px] text-zinc-600">
            Predictions: {data.predictionConfidence}
          </span>
        </div>
      </div>
      <Panel className="bg-[var(--surface-subdued)]">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <Eyebrow>Based on</Eyebrow>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              {data.basedOn.map((line, i) => (
                <li key={i}>· {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Missing / gaps</Eyebrow>
            <ul className="mt-2 space-y-1 text-xs text-zinc-600">
              {data.missing.map((line, i) => (
                <li key={i}>· {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Limitations</Eyebrow>
            <ul className="mt-2 space-y-1 text-xs text-zinc-600">
              {data.limitations.map((line, i) => (
                <li key={i}>· {line}</li>
              ))}
            </ul>
          </div>
        </div>

        {data.fieldCoverage.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-4">
            {data.fieldCoverage.map((f) => (
              <div
                key={f.label}
                className="rounded-md bg-[var(--surface-elevated)] px-2.5 py-1.5 text-[10px] ring-1 ring-inset ring-[var(--border-subtle)]"
              >
                <span className="text-zinc-500">{f.label}</span>
                <span
                  className={cn(
                    "ml-1.5 font-mono font-medium tabular-nums",
                    f.level === "high" && "text-accent",
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
      </Panel>
    </section>
  );
}
