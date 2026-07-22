"use client";

import Link from "next/link";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { DashboardInsights } from "@/lib/analytics";
import { buildCurrentBelief } from "@/lib/intelligence/presentation";
import {
  buildHeroSupportingReasons,
  buildSystemConfidenceSummary,
} from "@/lib/intelligence/intelligenceUiHelpers";
import { coachUrl, topicCoachLink } from "@/lib/coach/domainLinks";
import { CalendarRange, MessageCircle } from "lucide-react";

export function IntelligenceHero({
  state,
  analytics,
  primaryRecommendation,
  metaLine,
  trustLine,
}: {
  state: CoachWorkspaceState;
  analytics: DashboardInsights;
  primaryRecommendation: string;
  metaLine?: string;
  trustLine?: string;
}) {
  const currentBelief = buildCurrentBelief(state, analytics);
  const supporting = buildHeroSupportingReasons(state, analytics);
  const confidence = buildSystemConfidenceSummary(analytics);

  return (
    <section className="intelligence-hero rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#12141a] via-[#0d0e12] to-[#0a0b0e] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] pb-2.5">
        <p className="type-caption">
          Persistent athlete model
          {metaLine ? <span className="text-muted-foreground/80"> · {metaLine}</span> : null}
        </p>
        <p className="type-caption">
          System confidence: <span className="text-zinc-400">{confidence.level}</span>
          <span className="text-zinc-700"> — {confidence.reason}</span>
        </p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0 space-y-2.5">
          <div>
            <p className="type-section-label">Current focus</p>
            <h1 className="type-page-title mt-1">{state.currentFocus}</h1>
          </div>

          <div>
            <p className="type-section-label normal-case tracking-normal text-zinc-600">
              Current belief
            </p>
            <p className="type-body-muted mt-1 max-w-2xl">{currentBelief}</p>
          </div>

          <div>
            <p className="type-eyebrow">Primary action</p>
            <p className="type-body mt-1 max-w-2xl font-medium text-foreground">
              {primaryRecommendation}
            </p>
          </div>

          {supporting.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {supporting.map((r) => (
                <span
                  key={r}
                  className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-500"
                >
                  {r}
                </span>
              ))}
            </div>
          ) : null}

          {trustLine ? <p className="text-[10px] text-zinc-700">{trustLine}</p> : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/plan"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/15 px-3 py-1.5 text-[12px] font-medium text-teal-200 ring-1 ring-teal-500/25 hover:bg-teal-500/20"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Open next plan
            </Link>
            <Link
              href={coachUrl({ investigate: true })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-900 hover:bg-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Ask Coach
            </Link>
            <Link
              href={topicCoachLink("readiness-change", "Why did my readiness change this week?")}
              className="rounded-lg px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            >
              Investigate readiness
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
