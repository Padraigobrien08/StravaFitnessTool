"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import { ReadinessRing } from "@/components/home/primitives/readiness-ring";
import { Sparkline } from "@/components/home/primitives/sparkline";
import type { RunsHeroView } from "@/lib/runs/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

export function RunHistoryHero({ hero }: { hero: RunsHeroView }) {
  const mixScore = Math.min(
    100,
    Math.round(hero.easyPct * 0.6 + hero.typeCount * 8)
  );

  return (
    <DashboardPanel
      variant="hero"
      padding="hero"
      elevated
      hover={false}
      className="border-l-[3px] border-l-teal-500/45 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_75%_50%_at_100%_0%,rgba(45,212,191,0.06),transparent_55%)]"
    >
      <div className="relative grid gap-5 lg:grid-cols-[1fr_minmax(220px,280px)] lg:gap-8">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={dash.labelAccent}>Activity intelligence</span>
            <ConfidenceBadge level={hero.confidence} />
          </div>

          <div>
            <h1 className={dash.h1}>{hero.title}</h1>
            <p className="mt-1 text-sm tabular-nums text-zinc-400">
              {hero.runCount} runs · {hero.totalKm} · {hero.typeCount} workout
              types
            </p>
          </div>

          <div className="space-y-2 text-sm text-zinc-400">
            <p>
              <span className="font-medium text-zinc-300">Recent block · </span>
              {hero.blockEmphasis}
            </p>
            <p>
              <span className="font-medium text-zinc-300">Most common · </span>
              {hero.commonSession}
            </p>
            <p>
              <span className="font-medium text-zinc-300">Trend · </span>
              {hero.currentTrend}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.05] pt-3">
            {hero.inlineMetrics.map((m) => (
              <div key={m.label} className="flex items-baseline gap-2">
                <dt className={dash.label}>{m.label}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className={dash.metricSm}>{m.value}</span>
                  {m.hint ? <span className={dash.muted}>{m.hint}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <aside
          className="flex flex-col gap-4 rounded-xl bg-white/[0.03] p-4"
          aria-label="Distribution and load"
        >
          <div className="flex items-center gap-4">
            <ReadinessRing score={mixScore} size={80} showGlow />
            <div className="min-w-0 flex-1 text-xs text-zinc-500">
              <p className="font-medium text-zinc-300">Session mix</p>
              <p className="mt-0.5">{hero.easyPct}% easy in lifetime split</p>
            </div>
          </div>
          <div>
            <p className={cn(dash.label, "mb-1")}>Weekly frequency</p>
            <Sparkline
              data={hero.mixSparkline}
              fullWidth
              height={28}
              positive
            />
          </div>
          <div>
            <p className={cn(dash.label, "mb-1")}>Volume trend (km)</p>
            <Sparkline
              data={hero.loadSparkline}
              fullWidth
              height={28}
              positive={
                hero.loadSparkline.length >= 2 &&
                (hero.loadSparkline.at(-1) ?? 0) >=
                  (hero.loadSparkline.at(-2) ?? 0)
              }
            />
          </div>
        </aside>
      </div>
    </DashboardPanel>
  );
}
