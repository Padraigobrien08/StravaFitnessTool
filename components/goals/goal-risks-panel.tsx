"use client";

import { Eyebrow, Panel } from "@/components/console/console-kit";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { GoalRiskView } from "@/lib/goals/viewModels";
import { cn } from "@/lib/utils";

const severityStyle = {
  high: "border-l-red-500/50 bg-red-500/[0.05]",
  medium: "border-l-amber-500/45 bg-amber-500/[0.04]",
  low: "border-l-[var(--border-default)] bg-[var(--surface-subdued)]",
};

export function GoalRisksPanel({ risks }: { risks: GoalRiskView[] }) {
  return (
    <Panel>
      <Eyebrow className="mb-2.5">What could prevent success?</Eyebrow>
      <p className="mb-4 text-xs leading-snug text-zinc-500">
        Risks ranked by training evidence — each includes a mitigation you can act on this week.
      </p>
      <div className="space-y-3">
        {risks.map((risk, i) => (
          <div
            key={`${risk.title}-${i}`}
            className={cn(
              "rounded-xl border-l-[3px] px-4 py-3.5 ring-1 ring-[var(--border-subtle)]",
              severityStyle[risk.severity],
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-200">{risk.title}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {risk.severity}
                </span>
                <ConfidenceBadge level={risk.confidence} />
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Evidence · </span>
              {risk.evidence}
            </p>
            <p className="mt-2 text-xs text-accent/85">
              <span className="font-medium text-accent/70">Mitigation · </span>
              {risk.mitigation}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
