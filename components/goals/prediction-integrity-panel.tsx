"use client";

import { Eyebrow, Panel, Readout } from "@/components/console/console-kit";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { RaceProjectionView } from "@/lib/performance/viewModels";

export function PredictionIntegrityPanel({ projection }: { projection: RaceProjectionView }) {
  const conf = projection.primary?.confidence ?? "medium";

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Eyebrow>Prediction integrity</Eyebrow>
        <ConfidenceBadge level={conf} />
      </div>

      <p className="mb-4 text-sm text-zinc-400">
        Evidence-based estimate — not a guarantee. Spread reflects model agreement and data
        completeness.
      </p>

      {projection.primary ? (
        <div className="mb-5 rounded-lg bg-accent/[0.06] px-4 py-3 ring-1 ring-inset ring-accent/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {projection.primary.label} corridor
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <Readout value={projection.primary.timeDisplay} className="text-2xl" />
            <span className="font-mono text-base tabular-nums text-zinc-500">
              {projection.primary.spreadDisplay}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs tabular-nums text-zinc-500">
            Band {projection.primary.rangeDisplay}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Strong signals
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            {projection.confidenceDrivers.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent/70">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Weak signals / gaps
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            {projection.confidenceReducers.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-zinc-600">○</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {projection.fadeRisk ? (
        <p className="mt-4 text-xs text-amber-400/85">⚠ {projection.fadeRisk}</p>
      ) : null}
    </Panel>
  );
}
