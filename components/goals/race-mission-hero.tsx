"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import { ReadinessRing } from "@/components/home/primitives/readiness-ring";
import { Sparkline } from "@/components/home/primitives/sparkline";
import type { RaceMissionHeroView } from "@/lib/goals/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

export function RaceMissionHero({ hero }: { hero: RaceMissionHeroView }) {
  const borderTone =
    hero.readinessScore >= 70
      ? "border-l-teal-500/50"
      : hero.readinessScore >= 50
        ? "border-l-amber-500/40"
        : "border-l-zinc-500/35";

  return (
    <DashboardPanel
      variant="hero"
      padding="hero"
      elevated
      hover={false}
      className={cn(
        "border-l-[3px]",
        borderTone,
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,rgba(45,212,191,0.07),transparent_55%)]"
      )}
    >
      <div className="relative grid gap-5 lg:grid-cols-[1fr_minmax(240px,300px)] lg:gap-8">
        <div className="min-w-0 space-y-3">
          <span className={dash.labelAccent}>Race mission control</span>
          <div>
            <h1 className={dash.h1}>{hero.missionTitle}</h1>
            {hero.targetTimeDisplay ? (
              <p className="mt-1 text-sm text-zinc-400">
                Target ·{" "}
                <span className="font-semibold tabular-nums text-zinc-200">
                  {hero.targetTimeDisplay}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-inset ring-white/[0.06]">
              Readiness ·{" "}
              <strong className="text-teal-300/90">{hero.readinessLabel}</strong>
            </span>
            <ConfidenceBadge level={hero.confidence} />
            <span className="text-xs text-zinc-600">
              Confidence {hero.confidenceLabel}
            </span>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="rounded-lg bg-teal-500/[0.06] px-3 py-2 text-zinc-400">
              <span className="font-medium text-teal-400/90">Strongest · </span>
              {hero.strongestSignal}
            </p>
            <p className="rounded-lg bg-amber-500/[0.06] px-3 py-2 text-zinc-400">
              <span className="font-medium text-amber-400/90">Limiter · </span>
              {hero.biggestLimiter}
            </p>
          </div>

          <p className={cn(dash.lead, "text-zinc-300/90")}>{hero.recommendation}</p>

          {!hero.hasRaceGoal ? (
            <p className="text-xs text-zinc-600">
              Set a race date below to unlock countdown and mission-specific
              readiness.
            </p>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-xl bg-white/[0.03] p-4">
          <ReadinessRing score={hero.readinessScore} size={100} showGlow />
          {hero.projectedFinish ? (
            <div className="border-b border-white/[0.05] pb-3">
              <p className={dash.label}>Projected finish</p>
              <p className="font-display text-2xl font-bold tabular-nums text-white">
                {hero.projectedFinish}
                {hero.projectedSpread ? (
                  <span className="ml-2 text-base font-normal text-zinc-500">
                    {hero.projectedSpread}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
          {hero.daysUntilRace != null && hero.raceDateDisplay ? (
            <div className="text-xs text-zinc-500">
              <p>
                <span className="text-zinc-600">Race · </span>
                {hero.raceDateDisplay}
              </p>
              <p className="mt-0.5 tabular-nums">
                {hero.daysUntilRace === 0
                  ? "Race day"
                  : `${hero.daysUntilRace} days out`}
              </p>
            </div>
          ) : null}
          <div>
            <p className={cn(dash.label, "mb-1")}>Volume trajectory</p>
            <Sparkline data={hero.trajectorySparkline} fullWidth height={32} positive />
          </div>
        </aside>
      </div>
    </DashboardPanel>
  );
}
