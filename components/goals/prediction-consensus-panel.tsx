"use client";

import { Eyebrow, Panel, Readout } from "@/components/console/console-kit";
import type { ModelConsensusRow } from "@/lib/goals/viewModels";
import type { RacePredictionAnalysis } from "@/lib/analytics/predictions";
import { cn } from "@/lib/utils";

const agreementStyle = {
  tight: { bar: "bg-accent/60", label: "Tight cluster", text: "text-accent" },
  moderate: { bar: "bg-amber-500/50", label: "Moderate spread", text: "text-amber-400/85" },
  wide: { bar: "bg-red-500/40", label: "Wide disagreement", text: "text-red-400/80" },
};

export function PredictionConsensusPanel({
  rows,
  analysis,
}: {
  rows: ModelConsensusRow[];
  analysis: RacePredictionAnalysis;
}) {
  if (rows.length === 0) {
    return (
      <Panel>
        <Eyebrow className="mb-2.5">Prediction consensus</Eyebrow>
        <p className="text-sm text-zinc-500">
          Add timed efforts (5K–15K) to see how models cluster on your fitness.
        </p>
      </Panel>
    );
  }

  const maxSpread = Math.max(...analysis.consensus.map((c) => c.spreadSec), 1);

  return (
    <Panel>
      <Eyebrow className="mb-2.5">Prediction consensus</Eyebrow>
      <p className="mb-4 text-xs leading-snug text-zinc-500">
        Where models agree, trust the corridor. Wider spread at longer distances usually means
        extrapolation — pace conservatively.
      </p>

      <div className="space-y-3">
        {rows.map((row) => {
          const c = analysis.consensus.find((x) => x.label === row.label);
          const spreadPct = c ? Math.min(100, Math.round((c.spreadSec / maxSpread) * 100)) : 30;
          const style = agreementStyle[row.agreement];

          return (
            <div
              key={row.label}
              className="rounded-xl bg-[var(--surface-subdued)] px-4 py-3.5 ring-1 ring-[var(--border-subtle)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">{row.label}</span>
                <Readout value={row.consensusDisplay} className="text-xl" />
              </div>
              {row.spreadDisplay ? (
                <p className="mt-0.5 font-mono text-xs tabular-nums text-zinc-500">
                  Corridor · {row.spreadDisplay}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-zinc-500">Narrow model agreement</p>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-elevated)] ring-1 ring-[var(--border-subtle)]">
                <div
                  className={cn("h-full rounded-full transition-all", style.bar)}
                  style={{ width: `${Math.max(12, spreadPct)}%` }}
                />
              </div>
              <p className={cn("mt-1.5 text-[11px]", style.text)}>{style.label}</p>
            </div>
          );
        })}
      </div>

      {analysis.models.length > 0 ? (
        <p className="mt-4 text-xs text-zinc-500">
          <span className="font-mono tabular-nums text-zinc-400">{analysis.models.length}</span>{" "}
          model paths · confidence <span className="text-zinc-400">{analysis.confidence}</span>
          {analysis.regression ? (
            <>
              {" "}
              · curve fit from{" "}
              <span className="font-mono tabular-nums text-zinc-400">
                {analysis.efforts.length}
              </span>{" "}
              efforts
            </>
          ) : null}
        </p>
      ) : null}
    </Panel>
  );
}
