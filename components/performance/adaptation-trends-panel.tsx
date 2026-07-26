"use client";

import { TrendChart } from "@/components/home/primitives/sparkline";
import type { AdaptationTrendView } from "@/lib/performance/viewModels";
import { Eyebrow, Panel, PanelHeader } from "@/components/console/console-kit";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

export function AdaptationTrendsPanel({ trends }: { trends: AdaptationTrendView[] }) {
  return (
    <Panel>
      <PanelHeader title="Adaptation trends" />
      <p className={cn(dash.muted, "mb-4 max-w-2xl")}>
        Signals that explain whether you are getting faster — charts support the narrative, not the
        other way around.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {trends.map((t) => (
          <div
            key={t.id}
            className="rounded-xl bg-[var(--surface-subdued)] p-3.5 ring-1 ring-inset ring-[var(--border-subtle)]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <Eyebrow>{t.label}</Eyebrow>
              {t.caption ? (
                <span className="font-mono text-[10px] tabular-nums text-accent">{t.caption}</span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{t.interpretation}</p>
            <TrendChart
              data={t.data}
              positive={t.positive ?? undefined}
              height={40}
              className="mt-3"
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
