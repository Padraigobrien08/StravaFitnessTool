"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "./primitives/dashboard-panel";
import { ReadinessRing } from "./primitives/readiness-ring";
import { Sparkline } from "./primitives/sparkline";
import type { HeroViewModel } from "@/lib/home/dashboardData";
import { dash } from "./primitives/tokens";
import { cn } from "@/lib/utils";
import { ArrowRight, HelpCircle } from "lucide-react";

export function HeroIntelligence({ hero }: { hero: HeroViewModel }) {
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <DashboardPanel
      variant="hero"
      padding="hero"
      elevated
      hover={false}
      className="before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(45,212,191,0.07),transparent_50%)]"
    >
      <div className="relative grid items-center gap-5 lg:grid-cols-[1fr_minmax(240px,300px)] lg:gap-8">
        <div className="min-w-0 space-y-3 lg:space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={dash.labelAccent}>Priority intelligence</span>
            <ConfidenceBadge level={hero.confidence} />
          </div>

          <div className="max-w-4xl space-y-2">
            <h1 className={dash.h1}>{hero.title}</h1>
            <p className={cn(dash.lead, "text-zinc-300/90")}>
              {hero.interpretation}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-white/[0.05] pt-4">
            {hero.inlineMetrics.map((m) => (
              <div key={m.label} className="flex items-baseline gap-3">
                <dt className={cn(dash.label, "shrink-0")}>{m.label}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className={dash.metricSm}>{m.value}</span>
                  {m.hint ? (
                    <span className={dash.muted}>{m.hint}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/plan">
              <Button size="sm" className="h-9">
                Open next week plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            {hero.whyBullets.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-zinc-500"
                onClick={() => setWhyOpen((v) => !v)}
                aria-expanded={whyOpen}
              >
                <HelpCircle className="mr-1.5 h-4 w-4" />
                Why?
              </Button>
            ) : null}
          </div>
          {whyOpen && hero.whyBullets.length > 0 ? (
            <ul className="max-w-3xl space-y-1 border-l-2 border-teal-500/25 pl-3 text-xs leading-relaxed text-zinc-500">
              {hero.whyBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside
          className="flex items-center gap-5 rounded-xl bg-white/[0.03] p-4 lg:flex-col lg:items-center lg:gap-4 lg:p-5"
          aria-label="Readiness and load"
        >
          <ReadinessRing score={hero.readinessScore} size={108} showGlow />
          <div className="min-w-0 flex-1 space-y-2 lg:w-full lg:max-w-[220px]">
            <p className="text-sm text-zinc-400 lg:text-center">
              {hero.readinessLabel}
            </p>
            <Sparkline
              data={hero.loadSparkline}
              fullWidth
              height={36}
              positive={hero.tsb >= 0}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 lg:justify-center">
              <span className="tabular-nums">{hero.trendLabel}</span>
              <span>
                Fresh <strong className="text-zinc-300">{hero.freshness}</strong>
              </span>
              <span className="text-zinc-600">{hero.freshnessLabel}</span>
            </div>
          </div>
        </aside>
      </div>
    </DashboardPanel>
  );
}
