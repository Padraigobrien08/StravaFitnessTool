"use client";

import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { useAthleteIntelligence } from "@/hooks/use-athlete-intelligence";
import { IntelligenceWorkspace } from "./intelligence-workspace";
import { IntelligenceHero } from "./intelligence-hero";
import {
  IntelligenceCoachingState,
  IntelligenceSignals,
  IntelligenceRisksOpportunities,
  IntelligenceMemory,
  IntelligenceEcosystem,
  IntelligenceTrajectory,
  IntelligenceDomains,
} from "./intelligence-sections";
import { coachUrl } from "@/lib/coach/domainLinks";

export function IntelligencePage() {
  const intel = useAthleteIntelligence();

  if (intel.loading && !intel.state) {
    return (
      <RequireData>
        <IntelligenceWorkspace>
          <div className="space-y-4 p-4">
            <div className="skeleton-shimmer h-40 rounded-2xl" />
            <div className="skeleton-shimmer h-32 rounded-xl" />
          </div>
        </IntelligenceWorkspace>
      </RequireData>
    );
  }

  if (!intel.state || !intel.analytics || !intel.primaryRecommendation) {
    return (
      <RequireData>
        <p className="text-sm text-zinc-600">Load training data to view intelligence.</p>
      </RequireData>
    );
  }

  return (
    <RequireData>
      <IntelligenceWorkspace>
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-600">
            System-driven athlete model — not a chat interface
          </p>
          <Link
            href={coachUrl()}
            className="text-xs text-teal-400/80 hover:underline"
          >
            Open Coach →
          </Link>
        </div>

        <div className="space-y-4">
          <IntelligenceHero
            state={intel.state}
            analytics={intel.analytics}
            primaryRecommendation={intel.primaryRecommendation}
          />
          <IntelligenceCoachingState
            state={intel.state}
            bullets={intel.coachingBullets}
          />
          <IntelligenceSignals signals={intel.signals} />
          <IntelligenceRisksOpportunities items={intel.risksAndOpportunities} />
          <IntelligenceMemory memory={intel.memory} />
          {intel.ecosystem ? (
            <IntelligenceEcosystem ecosystem={intel.ecosystem} />
          ) : null}
          <IntelligenceTrajectory series={intel.trajectories} />
          <IntelligenceDomains domains={intel.state.domains} />
        </div>
      </IntelligenceWorkspace>
    </RequireData>
  );
}
