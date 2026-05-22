"use client";

import Link from "next/link";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { DashboardInsights } from "@/lib/analytics";
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

  const beliefLead = buildBeliefLead(state, analytics, snap);
  const profileLine =
    snap.archetypeLabel ??
    analytics.trainingEcosystem.archetype.label ??
    "Runner";

  return (
    <section className="intelligence-hero relative overflow-hidden rounded-xl bg-gradient-to-br from-[#111318] via-[#0d0e12] to-[#0a0b0e] px-5 py-5 sm:px-6 sm:py-6">
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-[12px] text-zinc-500">
            Athlete intelligence
            {metaLine ? (
              <span className="text-zinc-600"> · {metaLine}</span>
            ) : null}
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-zinc-50 sm:text-[1.65rem]">
            {state.currentFocus}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            {beliefLead}
          </p>
          <div className="mt-4 rounded-lg bg-white/[0.03] px-3.5 py-3">
            <p className="text-[12px] text-zinc-600">Primary recommendation</p>
            <p className="mt-1 text-[14px] leading-relaxed text-zinc-200">
              {primaryRecommendation}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={coachUrl({ investigate: true })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Ask Coach
            </Link>
            <Link
              href={topicCoachLink(
                "readiness-change",
                "Why did my readiness change this week?"
              )}
              className="rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-zinc-200"
            >
              Investigate readiness
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:w-[220px]">
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
            sub="Model"
          />
          <HeroMetric label="Profile" value={profileLine} sub="Archetype" compact />
        </div>
      </div>
    </section>
  );
}

function buildBeliefLead(
  state: CoachWorkspaceState,
  analytics: DashboardInsights,
  snap: CoachWorkspaceState["snapshot"]
): string {
  const parts: string[] = [];
  if (snap.daysToRace != null) {
    parts.push(`${snap.daysToRace} days to race`);
  } else if (snap.raceLabel) {
    parts.push(snap.raceLabel);
  }
  if (snap.freshness != null && snap.freshness >= 60) {
    parts.push("freshness is high");
  } else if (snap.freshness != null && snap.freshness < 45) {
    parts.push("freshness is constrained");
  }
  if (snap.readinessLabel) {
    parts.push(`readiness is ${snap.readinessLabel.toLowerCase()}`);
  }
  if (analytics.intensityAdvice.status === "too_hard") {
    parts.push("intensity stacking remains elevated");
  } else if (snap.riskLevel === "low") {
    parts.push("load risk is contained");
  }

  if (parts.length === 0) {
    return state.focusRationale;
  }
  const lead = parts.slice(0, 3).join(", ");
  return lead.charAt(0).toUpperCase() + lead.slice(1) + ".";
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
    <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
      <p className="text-[11px] text-zinc-600">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-medium tabular-nums text-zinc-100 capitalize",
          compact ? "text-[13px] leading-snug" : "text-xl"
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p> : null}
    </div>
  );
}
