"use client";

import Link from "next/link";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { AchievementMilestoneView } from "@/lib/performance/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const categoryAccent: Record<string, string> = {
  speed: "border-l-teal-500/45",
  endurance: "border-l-blue-500/40",
  consistency: "border-l-violet-500/40",
  race_execution: "border-l-amber-500/45",
};

export function AchievementTimeline({ milestones }: { milestones: AchievementMilestoneView[] }) {
  const grouped = ["speed", "endurance", "consistency", "race_execution"] as const;

  return (
    <PanelChrome title="Achievement timeline">
      <p className={cn(dash.muted, "mb-4")}>
        PRs and milestones with context — not a flat results table.
      </p>

      {milestones.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No milestones detected yet. Timed efforts and consistent blocks will populate this feed.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((cat) => {
            const items = milestones.filter((m) => m.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h4 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  {items[0].categoryLabel}
                </h4>
                <div className="space-y-2.5">
                  {items.map((m) => (
                    <article
                      key={m.id}
                      className={cn(
                        "rounded-xl border border-white/[0.05] border-l-[3px] bg-white/[0.02] px-4 py-3.5 transition-colors hover:bg-white/[0.035]",
                        categoryAccent[m.category],
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-semibold text-zinc-50">
                            {m.title}
                          </h3>
                          <p className="mt-0.5 font-display text-lg tabular-nums text-teal-300/95">
                            {m.timeDisplay}
                            {m.deltaDisplay ? (
                              <span className="ml-2 text-sm font-normal text-zinc-500">
                                · {m.deltaDisplay}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <ConfidenceBadge level={m.confidence} />
                      </div>

                      <p className="mt-2 text-xs text-zinc-600">
                        {m.dateDisplay}
                        {m.runName && m.runId ? (
                          <>
                            {" · "}
                            <Link
                              href={`/runs/${m.runId}`}
                              className="text-teal-400/90 hover:text-teal-300"
                            >
                              {m.runName}
                            </Link>
                          </>
                        ) : null}
                      </p>

                      <div className="mt-2.5">
                        <p className={dash.label}>Triggered by</p>
                        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                          {m.triggers.map((t, i) => (
                            <li key={i}>· {t}</li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelChrome>
  );
}
