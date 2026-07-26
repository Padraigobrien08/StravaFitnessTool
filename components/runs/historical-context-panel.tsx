"use client";

import type { HistoricalContextView } from "@/lib/runs/viewModels";
import { Eyebrow, Panel } from "@/components/console/console-kit";

export function HistoricalContextPanel({ data }: { data: HistoricalContextView }) {
  return (
    <Panel>
      <Eyebrow>Athlete memory · longitudinal context</Eyebrow>
      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {data.items.map((item) => (
          <li
            key={item.label}
            className="rounded-md bg-[var(--surface-subdued)] px-2.5 py-2 ring-1 ring-[var(--border-subtle)]"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{item.label}</p>
            <p className="mt-0.5 font-mono text-[12px] font-medium tabular-nums text-foreground">
              {item.value}
            </p>
            {item.detail ? (
              <p className="mt-0.5 text-[10px] leading-snug text-zinc-600">{item.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
