"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import { ReadinessRing } from "@/components/home/primitives/readiness-ring";
import { Sparkline } from "@/components/home/primitives/sparkline";
import type { PerformanceHeroView } from "@/lib/performance/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingUp } from "lucide-react";

const severityBorder = {
  positive: "border-l-teal-500/50",
  neutral: "border-l-zinc-500/40",
  warning: "border-l-amber-500/50",
};

export function PerformanceStateHero({ hero }: { hero: PerformanceHeroView }) {
  return (
    <DashboardPanel
      variant="hero"
      padding="hero"
      elevated
      hover={false}
      className={cn(
        "border-l-[3px]",
        severityBorder[hero.severity],
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,rgba(45,212,191,0.07),transparent_50%)]"
      )}
    >
      <div className="relative grid gap-5 lg:grid-cols-[1fr_minmax(240px,300px)] lg:gap-8">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={dash.labelAccent}>Performance intelligence</span>
            <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ring-1 ring-inset ring-white/[0.06]">
              {hero.classification}
            </span>
            <ConfidenceBadge level={hero.confidence} />
          </div>

          <div className="max-w-4xl space-y-2">
            <h1 className={dash.h1}>{hero.title}</h1>
            <p className={cn(dash.lead, "text-zinc-300/90")}>
              {hero.interpretation}
            </p>
          </div>

          <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
            <p className={dash.label}>Strongest signal</p>
            <p className="mt-1 flex items-start gap-2 text-sm text-zinc-200">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-teal-400/80" />
              {hero.strongestSignal}
            </p>
          </div>

          <p className="text-sm text-zinc-400">
            <span className="font-medium text-zinc-300">Focus · </span>
            {hero.recommendation}
          </p>

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

          <Link href="/goals">
            <Button size="sm" className="h-9">
              Race goals & strategy
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <aside
          className="flex flex-col gap-4 rounded-xl bg-white/[0.03] p-4"
          aria-label="Projection and trajectory"
        >
          {hero.projection ? (
            <div className="border-b border-white/[0.05] pb-4">
              <p className={dash.label}>Projected {hero.projection.label}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
                {hero.projection.timeDisplay}
                {hero.projection.rangeDisplay ? (
                  <span className="ml-2 text-base font-normal text-zinc-500">
                    {hero.projection.rangeDisplay}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Confidence: {hero.projection.confidenceLabel}
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-4">
            <ReadinessRing
              score={hero.trajectoryScore}
              size={88}
              showGlow
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-400">{hero.trajectoryLabel}</p>
              <p className="mt-0.5 text-xs text-zinc-600">
                Readiness {hero.readinessScore} · {hero.readinessLabel}
              </p>
              <Sparkline
                data={hero.sparkline}
                fullWidth
                height={32}
                positive={hero.severity === "positive"}
                className="mt-2"
              />
            </div>
          </div>
        </aside>
      </div>
    </DashboardPanel>
  );
}
