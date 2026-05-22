"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { RaceProjectionView } from "@/lib/performance/viewModels";
import { dash } from "@/components/home/primitives/tokens";

export function PredictionIntegrityPanel({
  projection,
}: {
  projection: RaceProjectionView;
}) {
  const conf = projection.primary?.confidence ?? "medium";

  return (
    <PanelChrome title="Prediction integrity" accent>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">
          Evidence-based estimate — not a guarantee. Spread reflects model
          agreement and data completeness.
        </p>
        <ConfidenceBadge level={conf} />
      </div>

      {projection.primary ? (
        <div className="mb-5 rounded-lg border border-teal-500/15 bg-teal-500/[0.05] px-4 py-3">
          <p className={dash.label}>{projection.primary.label} corridor</p>
          <p className="font-display text-2xl font-bold tabular-nums text-white">
            {projection.primary.timeDisplay}
            <span className="ml-2 text-base font-normal text-zinc-500">
              {projection.primary.spreadDisplay}
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Band {projection.primary.rangeDisplay}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className={dash.label}>Strong signals</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            {projection.confidenceDrivers.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-teal-500/60">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={dash.label}>Weak signals / gaps</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            {projection.confidenceReducers.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span>○</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {projection.fadeRisk ? (
        <p className="mt-4 text-xs text-amber-400/85">⚠ {projection.fadeRisk}</p>
      ) : null}
    </PanelChrome>
  );
}
