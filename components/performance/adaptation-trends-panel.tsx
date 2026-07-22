"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { TrendChart } from "@/components/home/primitives/sparkline";
import type { AdaptationTrendView } from "@/lib/performance/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

export function AdaptationTrendsPanel({ trends }: { trends: AdaptationTrendView[] }) {
  return (
    <PanelChrome title="Adaptation trends">
      <p className={cn(dash.muted, "mb-4 max-w-2xl")}>
        Signals that explain whether you are getting faster — charts support the narrative, not the
        other way around.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {trends.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold text-zinc-300">{t.label}</h4>
              {t.caption ? (
                <span className="text-[10px] tabular-nums text-teal-400/75">{t.caption}</span>
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
    </PanelChrome>
  );
}
