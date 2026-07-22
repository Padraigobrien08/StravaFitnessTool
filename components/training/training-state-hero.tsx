"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import { ReadinessRing } from "@/components/home/primitives/readiness-ring";
import { Sparkline } from "@/components/home/primitives/sparkline";
import type { TrainingStateHeroView } from "@/lib/training/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const severityBorder = {
  positive: "border-l-teal-500/50",
  neutral: "border-l-zinc-500/40",
  warning: "border-l-amber-500/50",
  critical: "border-l-red-500/55",
};

export function TrainingStateHero({ hero }: { hero: TrainingStateHeroView }) {
  return (
    <DashboardPanel
      variant="hero"
      padding="hero"
      elevated
      hover={false}
      className={cn(
        "border-l-[3px]",
        severityBorder[hero.severity],
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_70%_55%_at_100%_0%,rgba(45,212,191,0.06),transparent_55%)]",
      )}
    >
      <div className="relative grid gap-5 lg:grid-cols-[1fr_minmax(220px,280px)] lg:gap-8">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={dash.labelAccent}>Training state</span>
            <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ring-1 ring-inset ring-white/[0.06]">
              {hero.classification}
            </span>
            <ConfidenceBadge level={hero.confidence} />
          </div>

          <div className="max-w-4xl space-y-2">
            <h1 className={dash.h1}>{hero.title}</h1>
            <p className={cn(dash.lead, "text-zinc-300/90")}>{hero.interpretation}</p>
          </div>

          <div className="rounded-lg border border-teal-500/15 bg-teal-500/[0.05] px-4 py-3">
            <p className={dash.label}>Current recommendation</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-200">{hero.recommendation}</p>
          </div>

          {hero.raceContext ? (
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Race · </span>
              {hero.raceContext}
            </p>
          ) : null}

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
              Review goals & readiness
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <aside
          className="flex items-center gap-4 rounded-xl bg-white/[0.03] p-4 lg:flex-col lg:items-center lg:gap-3"
          aria-label="Readiness telemetry"
        >
          <ReadinessRing score={hero.readinessScore} size={100} showGlow />
          <div className="min-w-0 flex-1 space-y-2 lg:w-full lg:text-center">
            <p className="text-sm text-zinc-400">{hero.readinessLabel}</p>
            <p className="text-xs text-zinc-500">
              Freshness <strong className="text-zinc-200">{hero.freshness}</strong>
              <span className="text-zinc-600"> · {hero.freshnessLabel}</span>
            </p>
            <Sparkline
              data={hero.loadSparkline}
              fullWidth
              height={32}
              positive={hero.freshness >= 55}
            />
            <p className="text-[11px] tabular-nums text-zinc-600">{hero.trendLabel}</p>
          </div>
        </aside>
      </div>
    </DashboardPanel>
  );
}
