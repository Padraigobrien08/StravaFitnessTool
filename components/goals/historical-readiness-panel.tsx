"use client";

import { Eyebrow, Panel } from "@/components/console/console-kit";

export function HistoricalReadinessPanel({ items }: { items: { label: string; value: string }[] }) {
  return (
    <Panel>
      <Eyebrow className="mb-2.5">Historical readiness context</Eyebrow>
      <p className="mb-4 text-xs leading-snug text-zinc-500">
        Background from your training archive — anchors how current readiness compares to prior
        blocks.
      </p>
      <dl className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-0.5 rounded-lg bg-[var(--surface-subdued)] px-3 py-2.5 ring-1 ring-[var(--border-subtle)] sm:flex-row sm:items-baseline sm:justify-between"
          >
            <dt className="text-xs text-zinc-500">{item.label}</dt>
            <dd className="text-sm text-zinc-300">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
