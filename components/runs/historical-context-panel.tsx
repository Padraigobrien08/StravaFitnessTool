"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { HistoricalContextView } from "@/lib/runs/viewModels";
import { dash } from "@/components/home/primitives/tokens";

export function HistoricalContextPanel({
  data,
}: {
  data: HistoricalContextView;
}) {
  return (
    <PanelChrome title="Historical context" subdued>
      <p className={`${dash.muted} mb-4`}>
        Connect individual sessions to blocks, volume peaks, and progression phases.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {data.items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg bg-white/[0.02] px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]"
          >
            <dt className={dash.label}>{item.label}</dt>
            <dd className="mt-1 text-sm text-zinc-300">{item.value}</dd>
          </div>
        ))}
      </dl>
    </PanelChrome>
  );
}
