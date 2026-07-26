"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { ModelConsensusRow } from "@/lib/goals/viewModels";
import type { RacePredictionAnalysis } from "@/lib/analytics/predictions";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const agreementStyle = {
  tight: { bar: "bg-accent/55", label: "Tight cluster", text: "text-accent/90" },
  moderate: { bar: "bg-amber-500/45", label: "Moderate spread", text: "text-amber-400/85" },
  wide: { bar: "bg-red-500/35", label: "Wide disagreement", text: "text-red-400/80" },
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
      <PanelChrome title="Prediction consensus" subdued>
        <p className="text-sm text-zinc-500">
          Add timed efforts (5K–15K) to see how models cluster on your fitness.
        </p>
      </PanelChrome>
    );
  }

  const maxSpread = Math.max(...analysis.consensus.map((c) => c.spreadSec), 1);

  return (
    <PanelChrome title="Prediction consensus" accent>
      <p className={`${dash.muted} mb-4`}>
        Where models agree, trust the corridor. Wider spread at longer distances usually means
        extrapolation — pace conservatively.
      </p>

      <div className="space-y-4">
        {rows.map((row) => {
          const c = analysis.consensus.find((x) => x.label === row.label);
          const spreadPct = c ? Math.min(100, Math.round((c.spreadSec / maxSpread) * 100)) : 30;
          const style = agreementStyle[row.agreement];

          return (
            <div
              key={row.label}
              className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">{row.label}</span>
                <span className="font-display text-xl font-bold tabular-nums text-white">
                  {row.consensusDisplay}
                </span>
              </div>
              {row.spreadDisplay ? (
                <p className="mt-0.5 text-xs text-zinc-600">Corridor · {row.spreadDisplay}</p>
              ) : (
                <p className="mt-0.5 text-xs text-zinc-600">Narrow model agreement</p>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
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
        <p className="mt-4 text-xs text-zinc-600">
          {analysis.models.length} model paths · confidence{" "}
          <span className="text-zinc-400">{analysis.confidence}</span>
          {analysis.regression ? ` · curve fit from ${analysis.efforts.length} efforts` : null}
        </p>
      ) : null}
    </PanelChrome>
  );
}
