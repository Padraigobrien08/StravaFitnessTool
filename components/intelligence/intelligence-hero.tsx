"use client";

import Link from "next/link";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { DashboardInsights } from "@/lib/analytics";
import { coachUrl } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

export function IntelligenceHero({
  state,
  analytics,
  primaryRecommendation,
}: {
  state: CoachWorkspaceState;
  analytics: DashboardInsights;
  primaryRecommendation: string;
}) {
  const snap = state.snapshot;
  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;

  const subline = [
    snap.daysToRace != null
      ? `${snap.daysToRace} days to race`
      : snap.raceLabel
        ? snap.raceLabel
        : null,
    snap.freshness != null ? `freshness ${snap.freshness}` : null,
    snap.riskLevel !== "low" ? snap.riskLabel.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <section className="intelligence-hero relative overflow-hidden rounded-2xl border border-teal-500/12 bg-gradient-to-br from-teal-500/[0.08] via-[#0c0d10] to-[#09090b] p-5 sm:p-7">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-teal-400/[0.06] blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-teal-400/80">
            Athlete intelligence
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {state.currentFocus}
          </h1>
          {subline ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              {subline}
              {snap.riskLevel === "moderate" || snap.riskLevel === "elevated"
                ? ", but intensity stacking remains elevated."
                : "."}
            </p>
          ) : null}
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">
              Primary recommendation
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-teal-100/85">
              {primaryRecommendation}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-4 lg:flex-col lg:items-end lg:gap-3">
          <Metric label="Readiness" value={`${r.score}`} sub={r.label} />
          <Metric
            label="Freshness"
            value={snap.freshness != null ? String(snap.freshness) : "—"}
            sub={snap.fatigueLabel ?? undefined}
          />
          <Metric
            label="Confidence"
            value={snap.recommendationConfidence}
            sub={snap.archetypeLabel ?? "Runner"}
          />
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2 border-t border-white/[0.05] pt-4">
        <Link
          href={coachUrl({ investigate: true })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/25 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-100/90 hover:bg-teal-500/15"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Ask Coach
        </Link>
        <Link
          href={coachUrl({ q: "Why did my readiness change this week?", investigate: true })}
          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400 hover:border-white/[0.14] hover:text-zinc-200"
        >
          Investigate readiness
        </Link>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums text-white capitalize">
        {value}
      </p>
      {sub ? <p className="text-[11px] text-zinc-600">{sub}</p> : null}
    </div>
  );
}
