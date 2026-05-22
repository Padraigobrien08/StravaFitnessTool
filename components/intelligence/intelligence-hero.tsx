"use client";

import Link from "next/link";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { DashboardInsights } from "@/lib/analytics";
import { buildCurrentBelief } from "@/lib/intelligence/presentation";
import { coachUrl, topicCoachLink } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

export function IntelligenceHero({
  state,
  analytics,
  primaryRecommendation,
  metaLine,
}: {
  state: CoachWorkspaceState;
  analytics: DashboardInsights;
  primaryRecommendation: string;
  metaLine?: string;
}) {
  const snap = state.snapshot;
  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;
  const currentBelief = buildCurrentBelief(state, analytics);
  const profileLine =
    snap.archetypeLabel ??
    analytics.trainingEcosystem.archetype.label ??
    "Runner";

  return (
    <section className="intelligence-hero relative overflow-hidden rounded-xl bg-gradient-to-br from-[#12141a] via-[#0d0e12] to-[#0a0b0e] px-5 py-5 sm:px-6 sm:py-6">
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-[12px] text-zinc-500">
              Athlete intelligence
              {metaLine ? (
                <span className="text-zinc-600"> · {metaLine}</span>
              ) : null}
            </p>
            <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
              {state.currentFocus}
            </h1>
          </div>

          <div>
            <p className="text-[11px] font-medium text-zinc-600">Current belief</p>
            <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-zinc-300">
              {currentBelief}
            </p>
          </div>

          <div className="rounded-lg bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/[0.05]">
            <p className="text-[11px] font-medium text-zinc-500">Primary action</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-100">
              {primaryRecommendation}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-0.5">
            <Link
              href={coachUrl({ investigate: true })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-[13px] font-medium text-zinc-900 hover:bg-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Ask Coach
            </Link>
            <Link
              href={topicCoachLink(
                "readiness-change",
                "Why did my readiness change this week?"
              )}
              className="rounded-lg px-3 py-2 text-[13px] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            >
              Investigate readiness
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <HeroMetric label="Readiness" value={String(r.score)} sub={r.label} />
          <HeroMetric
            label="Freshness"
            value={
              snap.freshness != null ? String(Math.round(snap.freshness)) : "—"
            }
            sub={snap.fatigueLabel ?? undefined}
          />
          <HeroMetric
            label="Confidence"
            value={snap.recommendationConfidence}
            sub="Model belief"
          />
          <HeroMetric label="Profile" value={profileLine} sub="Archetype" compact />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  sub,
  compact,
}: {
  label: string;
  value: string;
  sub?: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] text-zinc-600">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-medium tabular-nums text-zinc-100 capitalize",
          compact ? "text-[13px] leading-snug" : "text-lg"
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p> : null}
    </div>
  );
}
