"use client";

import type { ActivityStateSummaryView } from "@/lib/runs/viewModels";

export function ActivityStateSummary({
  data,
}: {
  data: ActivityStateSummaryView;
}) {
  return (
    <section className="rounded-lg border border-teal-500/15 bg-teal-500/[0.04] px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-teal-500/70">
        Activity state
      </p>
      <p className="mt-1 text-[14px] font-medium leading-snug text-zinc-200">
        {data.headline}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {data.bullets.map((b) => (
          <li key={b} className="text-[12px] text-zinc-500">
            {b}
          </li>
        ))}
      </ul>
    </section>
  );
}
