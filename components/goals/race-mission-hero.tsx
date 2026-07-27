"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { ReadinessRing } from "@/components/home/primitives/readiness-ring";
import { Sparkline } from "@/components/home/primitives/sparkline";
import type { RaceMissionHeroView } from "@/lib/goals/viewModels";
import { Eyebrow, Panel, Readout } from "@/components/console/console-kit";

export function RaceMissionHero({ hero }: { hero: RaceMissionHeroView }) {
  return (
    <Panel className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,var(--home-signal-wash),transparent_55%)]" />
      <div className="relative grid gap-5 lg:grid-cols-[1fr_minmax(240px,300px)] lg:gap-8">
        <div className="min-w-0 space-y-3">
          <Eyebrow>Race mission control</Eyebrow>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {hero.missionTitle}
            </h1>
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
              <strong style={{ color: "var(--home-signal)" }}>{hero.readinessLabel}</strong>
            </span>
            <ConfidenceBadge level={hero.confidence} />
            <span className="text-xs text-zinc-600">Confidence {hero.confidenceLabel}</span>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p
              className="rounded-lg px-3 py-2 text-zinc-400"
              style={{ background: "var(--home-signal-wash)" }}
            >
              <span className="font-medium" style={{ color: "var(--home-signal)" }}>
                Strongest ·{" "}
              </span>
              {hero.strongestSignal}
            </p>
            <p className="rounded-lg bg-amber-500/[0.06] px-3 py-2 text-zinc-400">
              <span className="font-medium text-amber-400/90">Limiter · </span>
              {hero.biggestLimiter}
            </p>
          </div>

          <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-300/90">
            {hero.recommendation}
          </p>

          {!hero.hasRaceGoal ? (
            <p className="text-xs text-zinc-600">
              Set a race date below to unlock countdown and mission-specific readiness.
            </p>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-xl bg-[var(--surface-subdued)] p-4 ring-1 ring-[var(--border-subtle)]">
          <ReadinessRing score={hero.readinessScore} size={100} showGlow />
          {hero.projectedFinish ? (
            <div className="border-b border-white/[0.05] pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Projected finish
              </p>
              <Readout value={hero.projectedFinish} className="mt-1 text-[clamp(24px,4vw,32px)]" />
              {hero.projectedSpread ? (
                <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                  {hero.projectedSpread}
                </span>
              ) : null}
            </div>
          ) : null}
          {hero.daysUntilRace != null && hero.raceDateDisplay ? (
            <div className="text-xs text-zinc-500">
              <p>
                <span className="text-zinc-600">Race · </span>
                {hero.raceDateDisplay}
              </p>
              <p className="mt-0.5 tabular-nums">
                {hero.daysUntilRace === 0 ? "Race day" : `${hero.daysUntilRace} days out`}
              </p>
            </div>
          ) : null}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Volume trajectory
            </p>
            <Sparkline data={hero.trajectorySparkline} fullWidth height={32} positive />
          </div>
        </aside>
      </div>
    </Panel>
  );
}
