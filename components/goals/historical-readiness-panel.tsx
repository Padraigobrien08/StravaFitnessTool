"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { dash } from "@/components/home/primitives/tokens";

export function HistoricalReadinessPanel({ items }: { items: { label: string; value: string }[] }) {
  return (
    <PanelChrome title="Historical readiness context" subdued>
      <p className={`${dash.muted} mb-4`}>
        Background from your training archive — anchors how current readiness compares to prior
        blocks.
      </p>
      <dl className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-0.5 rounded-lg bg-white/[0.02] px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between"
          >
            <dt className="text-xs text-zinc-600">{item.label}</dt>
            <dd className="text-sm text-zinc-300">{item.value}</dd>
          </div>
        ))}
      </dl>
    </PanelChrome>
  );
}
