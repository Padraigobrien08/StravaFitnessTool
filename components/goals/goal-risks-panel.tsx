"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { GoalRiskView } from "@/lib/goals/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const severityStyle = {
  high: "border-l-red-500/50 bg-red-500/[0.04]",
  medium: "border-l-amber-500/40 bg-amber-500/[0.03]",
  low: "border-l-zinc-500/30 bg-white/[0.02]",
};

export function GoalRisksPanel({ risks }: { risks: GoalRiskView[] }) {
  return (
    <PanelChrome title="What could prevent success?" accent>
      <p className={`${dash.muted} mb-4`}>
        Risks ranked by training evidence — each includes a mitigation you can
        act on this week.
      </p>
      <div className="space-y-3">
        {risks.map((risk, i) => (
          <div
            key={`${risk.title}-${i}`}
            className={cn(
              "rounded-xl border border-white/[0.05] border-l-[3px] px-4 py-3.5",
              severityStyle[risk.severity]
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-200">{risk.title}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                  {risk.severity}
                </span>
                <ConfidenceBadge level={risk.confidence} />
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Evidence · </span>
              {risk.evidence}
            </p>
            <p className="mt-2 text-xs text-teal-400/85">
              <span className="font-medium text-teal-400/70">Mitigation · </span>
              {risk.mitigation}
            </p>
          </div>
        ))}
      </div>
    </PanelChrome>
  );
}
