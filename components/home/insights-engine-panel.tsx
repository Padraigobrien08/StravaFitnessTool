"use client";

import type { InsightRowViewModel } from "@/lib/home/dashboardData";
import { PanelChrome } from "./primitives/panel-chrome";
import { IntelligenceFeedCard } from "./intelligence-feed-card";
import { ops } from "./primitives/tokens";
import { cn } from "@/lib/utils";

export function InsightsEnginePanel({ rows }: { rows: InsightRowViewModel[] }) {
  const risks = rows.filter((r) => r.kind === "risk");
  const opportunities = rows.filter((r) => r.kind === "opportunity");

  return (
    <PanelChrome
      title="Athlete intelligence feed"
      href="/training"
      accent
      elevated
      className={cn(ops.intelMain)}
    >
      <p className="mb-4 max-w-3xl text-xs leading-relaxed text-zinc-500 sm:text-sm">
        Personalized coaching signals from load, efficiency, and goals — synthesized for your
        current training block.
      </p>

      {risks.length > 0 ? (
        <div className="mb-5">
          <h4 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-400/75">
            Risks
          </h4>
          <div className="space-y-2.5">
            {risks.map((r) => (
              <IntelligenceFeedCard key={r.id} item={r} />
            ))}
          </div>
        </div>
      ) : null}

      {opportunities.length > 0 ? (
        <div>
          <h4 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent/75">
            Opportunities
          </h4>
          <div className="space-y-2.5">
            {opportunities.map((r) => (
              <IntelligenceFeedCard key={r.id} item={r} />
            ))}
          </div>
        </div>
      ) : null}
    </PanelChrome>
  );
}
