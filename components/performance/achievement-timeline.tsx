"use client";

import Link from "next/link";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { AchievementMilestoneView } from "@/lib/performance/viewModels";
import { Eyebrow, Panel, PanelHeader } from "@/components/console/console-kit";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const categoryBar: Record<string, string> = {
  speed: "var(--home-signal)",
  endurance: "#3b82f6",
  consistency: "#8b5cf6",
  race_execution: "var(--hz-moderate)",
};

export function AchievementTimeline({ milestones }: { milestones: AchievementMilestoneView[] }) {
  const grouped = ["speed", "endurance", "consistency", "race_execution"] as const;

  return (
    <Panel>
      <PanelHeader title="Achievement timeline" />
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
                      className="rounded-xl bg-[var(--surface-subdued)] px-4 py-3.5 ring-1 ring-inset ring-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ borderLeft: `3px solid ${categoryBar[m.category]}` }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-semibold text-foreground">
                            {m.title}
                          </h3>
                          <p className="mt-0.5 font-mono text-lg tabular-nums text-accent">
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
                            <Link href={`/runs/${m.runId}`} className="text-accent hover:underline">
                              {m.runName}
                            </Link>
                          </>
                        ) : null}
                      </p>

                      <div className="mt-2.5">
                        <Eyebrow>Triggered by</Eyebrow>
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
    </Panel>
  );
}
