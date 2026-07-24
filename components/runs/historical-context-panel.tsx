"use client";

import type { HistoricalContextView } from "@/lib/runs/viewModels";
import { Panel } from "@/components/ui/panel";

export function HistoricalContextPanel({ data }: { data: HistoricalContextView }) {
  return (
    <Panel title="Athlete memory · longitudinal context" className="px-4">
      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {data.items.map((item) => (
          <li key={item.label} className="rounded-md bg-white/[0.02] px-2.5 py-2">
            <p className="text-[10px] text-zinc-600">{item.label}</p>
            <p className="mt-0.5 text-[12px] font-medium text-zinc-300">{item.value}</p>
            {item.detail ? (
              <p className="mt-0.5 text-[10px] leading-snug text-zinc-600">{item.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
