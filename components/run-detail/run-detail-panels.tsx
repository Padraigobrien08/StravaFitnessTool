"use client";

import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type {
  HistoricalCompareView,
  WorkoutDataQualityView,
} from "@/lib/runs/workoutDetailViewModels";
import { dash } from "@/components/home/primitives/tokens";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { cn } from "@/lib/utils";

export function WorkoutInterpretationPanel({ text }: { text: string }) {
  return (
    <PanelChrome title="Workout interpretation">
      <p className="text-sm leading-relaxed text-zinc-300">{text}</p>
    </PanelChrome>
  );
}

export function HistoricalContextPanel({ items }: { items: HistoricalCompareView[] }) {
  return (
    <PanelChrome title="Historical context" subdued>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset",
              item.tone === "positive"
                ? "bg-accent/[0.06] text-zinc-300 ring-accent/15"
                : "bg-white/[0.02] text-zinc-400 ring-white/[0.05]",
            )}
          >
            {item.text}
          </li>
        ))}
      </ul>
    </PanelChrome>
  );
}

export function WorkoutQualityPanel({ data }: { data: WorkoutDataQualityView }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className={dash.labelAccent}>Data integrity & confidence</span>
        <ConfidenceBadge level={data.interpretationConfidence} />
      </div>
      <DashboardPanel padding="compact" subdued>
        <p className="text-sm text-zinc-400">{data.summary}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <span className={data.hrCoverage ? "text-accent/80" : "text-zinc-600"}>
            HR {data.hrCoverage ? "✓" : "○"}
          </span>
          <span className={data.paceCoverage ? "text-accent/80" : "text-zinc-600"}>
            Pace {data.paceCoverage ? "✓" : "○"}
          </span>
          <span className="text-zinc-500">{data.lapCount} laps</span>
          <span className="text-zinc-500">Classification {data.classificationConfidence}</span>
        </div>
        {data.gaps.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-zinc-600">
            <li className={dash.label}>Missing for deeper analysis</li>
            {data.gaps.map((g, i) => (
              <li key={i}>· {g}</li>
            ))}
          </ul>
        ) : null}
      </DashboardPanel>
    </section>
  );
}

export function CompactStatsRail({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg bg-white/[0.02] px-3 py-2 ring-1 ring-inset ring-white/[0.05]"
        >
          <p className={dash.label}>{s.label}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-200">
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
