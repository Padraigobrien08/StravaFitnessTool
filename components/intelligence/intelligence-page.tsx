"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { useAthleteIntelligence } from "@/hooks/use-athlete-intelligence";
import { getStateEvolutionStrip } from "@/lib/intelligence/presentation";
import { IntelligenceWorkspace } from "./intelligence-workspace";
import { IntelligenceHero } from "./intelligence-hero";
import {
  IntelligenceStateEvolution,
  IntelligenceSignalBoard,
  IntelligenceDecisionSupport,
  IntelligenceMemoryTiles,
  IntelligenceEcosystemCompact,
  IntelligenceCoachEntries,
} from "./intelligence-sections";
import { coachUrl } from "@/lib/coach/domainLinks";

export function IntelligencePage() {
  const intel = useAthleteIntelligence();
  const { dataSourceLabel, importData } = useStrava();

  const evolution = useMemo(
    () =>
      intel.analytics ? getStateEvolutionStrip(intel.analytics) : [],
    [intel.analytics]
  );

  if (intel.loading && !intel.state) {
    return (
      <RequireData>
        <IntelligenceWorkspace>
          <div className="intelligence-model mx-auto max-w-6xl space-y-3">
            <div className="skeleton-shimmer h-32 rounded-xl" />
            <div className="skeleton-shimmer h-16 rounded-lg" />
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="skeleton-shimmer h-40 rounded-lg" />
              <div className="skeleton-shimmer h-40 rounded-lg" />
            </div>
          </div>
        </IntelligenceWorkspace>
      </RequireData>
    );
  }

  if (!intel.state || !intel.analytics || !intel.primaryRecommendation) {
    return (
      <RequireData>
        <p className="text-sm text-zinc-600">
          Load training data to view your athlete intelligence model.
        </p>
      </RequireData>
    );
  }

  const runCount = importData?.runs.length ?? intel.analytics.summary.runCount;
  const metaLine = [
    `${runCount} runs`,
    dataSourceLabel ?? "latest training data",
  ].join(" · ");

  const risks = intel.risksAndOpportunities.filter((r) => r.kind === "risk");
  const opportunities = intel.risksAndOpportunities.filter(
    (r) => r.kind === "opportunity"
  );

  return (
    <RequireData>
      <IntelligenceWorkspace>
        <div className="intelligence-model mx-auto max-w-6xl space-y-4 pb-10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-zinc-600">
              Persistent athlete model · updated from latest training data
            </p>
            <Link
              href={coachUrl()}
              className="shrink-0 text-[12px] text-zinc-500 hover:text-zinc-300"
            >
              Coach →
            </Link>
          </div>

          <IntelligenceHero
            state={intel.state}
            analytics={intel.analytics}
            primaryRecommendation={intel.primaryRecommendation}
            metaLine={metaLine}
          />

          <IntelligenceStateEvolution items={evolution} />

          <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
            <div className="space-y-4 lg:col-span-7">
              <IntelligenceSignalBoard signals={intel.signals} />
            </div>
            <div className="lg:col-span-5">
              <IntelligenceDecisionSupport
                risks={risks}
                opportunities={opportunities}
                recommendation={intel.primaryRecommendation}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <IntelligenceMemoryTiles memory={intel.memory} />
            {intel.ecosystem ? (
              <div className="rounded-xl bg-white/[0.015] px-4 py-4">
                <IntelligenceEcosystemCompact
                  ecosystem={intel.ecosystem}
                  embedded
                />
              </div>
            ) : null}
          </div>

          <IntelligenceCoachEntries domains={intel.state.domains} />
        </div>
      </IntelligenceWorkspace>
    </RequireData>
  );
}
