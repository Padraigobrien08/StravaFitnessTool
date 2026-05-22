"use client";

import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { useAthleteIntelligence } from "@/hooks/use-athlete-intelligence";
import { IntelligenceWorkspace } from "./intelligence-workspace";
import { IntelligenceHero } from "./intelligence-hero";
import {
  IntelligenceSignalBoard,
  IntelligenceSynthesis,
  IntelligenceMemoryTiles,
  IntelligenceEcosystemCompact,
  IntelligenceTrajectoryStrip,
  IntelligenceCoachEntries,
} from "./intelligence-sections";
import { coachUrl } from "@/lib/coach/domainLinks";

export function IntelligencePage() {
  const intel = useAthleteIntelligence();
  const { dataSourceLabel, importData } = useStrava();

  if (intel.loading && !intel.state) {
    return (
      <RequireData>
        <IntelligenceWorkspace>
          <div className="intelligence-model space-y-3">
            <div className="skeleton-shimmer h-36 rounded-xl" />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="skeleton-shimmer h-24 rounded-lg" />
              <div className="skeleton-shimmer h-24 rounded-lg" />
              <div className="skeleton-shimmer h-24 rounded-lg" />
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
    dataSourceLabel ?? "imported data",
  ].join(" · ");

  const risks = intel.risksAndOpportunities.filter((r) => r.kind === "risk");
  const opportunities = intel.risksAndOpportunities.filter(
    (r) => r.kind === "opportunity"
  );

  return (
    <RequireData>
      <IntelligenceWorkspace>
        <div className="intelligence-model mx-auto max-w-6xl space-y-5 pb-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-zinc-600">
              Persistent athlete model · updated from your latest training data
            </p>
            <Link
              href={coachUrl()}
              className="shrink-0 text-[12px] text-zinc-500 hover:text-zinc-300"
            >
              Open Coach →
            </Link>
          </div>

          <IntelligenceHero
            state={intel.state}
            analytics={intel.analytics}
            primaryRecommendation={intel.primaryRecommendation}
            metaLine={metaLine}
          />

          <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
            <div className="space-y-5 lg:col-span-8">
              <IntelligenceSignalBoard signals={intel.signals} />
              <IntelligenceSynthesis
                risks={risks}
                opportunities={opportunities}
                recommendation={intel.primaryRecommendation}
              />
            </div>
            <div className="lg:col-span-4">
              <IntelligenceTrajectoryStrip series={intel.trajectories} />
            </div>
          </div>

          <IntelligenceMemoryTiles memory={intel.memory} />

          {intel.ecosystem ? (
            <IntelligenceEcosystemCompact ecosystem={intel.ecosystem} />
          ) : null}

          <IntelligenceCoachEntries domains={intel.state.domains} />
        </div>
      </IntelligenceWorkspace>
    </RequireData>
  );
}
