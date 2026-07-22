"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { AdaptationSignalView } from "@/lib/runs/workoutDetailViewModels";
import { dash } from "@/components/home/primitives/tokens";

export function AdaptationSignalsPanel({ signals }: { signals: AdaptationSignalView[] }) {
  return (
    <PanelChrome title="What this workout contributed" accent>
      <p className={`${dash.muted} mb-4`}>
        Adaptation signals — why this session mattered in your block.
      </p>
      <div className="space-y-2.5">
        {signals.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-sm font-semibold text-zinc-100">{s.title}</h4>
              <ConfidenceBadge level={s.confidence} />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{s.evidence}</p>
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}
