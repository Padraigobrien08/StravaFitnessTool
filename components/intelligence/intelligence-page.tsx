"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { useAthleteIntelligence } from "@/hooks/use-athlete-intelligence";
import { getStateEvolutionStrip } from "@/lib/intelligence/presentation";
import { allBeliefs } from "@/lib/athlete-memory";
import { IntelligenceWorkspace } from "./intelligence-workspace";
import { IntelligenceHero } from "./intelligence-hero";
import {
  IntelligenceStateEvolution,
  IntelligenceSignalBoard,
  IntelligenceDecisionSupport,
  IntelligenceMemoryGrouped,
  IntelligenceEcosystemCompact,
  IntelligenceCoachEntries,
} from "./intelligence-sections";
import { IntelligenceRecentlyLearned } from "./intelligence-recently-learned";
import { IntelligenceRecommendationOutcomes } from "./intelligence-recommendation-outcomes";
import { IntelligenceRiskPatterns } from "./intelligence-risk-patterns";
import { IntelligencePeriodNarratives } from "./intelligence-period-narratives";
import { IntelligenceForecastAccuracy } from "./intelligence-forecast-accuracy";
import { IntelligencePhysiology } from "./intelligence-physiology";
import { IntelligenceCapabilityRadar } from "./intelligence-capability-radar";
import { IntelligenceProgressionBurndown } from "./intelligence-progression-burndown";
import { useRecommendationOutcomes } from "@/hooks/use-recommendation-outcomes";
import { useForecastAccuracy } from "@/hooks/use-forecast-accuracy";
import { coachUrl } from "@/lib/coach/domainLinks";

export function IntelligencePage() {
  const intel = useAthleteIntelligence();
  const { dataSourceLabel, importData } = useStrava();
  const outcomes = useRecommendationOutcomes(!!intel.state);
  const forecastAccuracy = useForecastAccuracy(!!intel.state);

  const evolution = useMemo(
    () => (intel.analytics ? getStateEvolutionStrip(intel.analytics) : []),
    [intel.analytics],
  );

  const beliefsById = useMemo(() => {
    if (!intel.adaptive?.memory) return undefined;
    const map = new Map<string, import("@/lib/athlete-memory/types").AthleteBelief>();
    for (const b of allBeliefs(intel.adaptive.memory)) {
      map.set(b.id, b);
    }
    return map;
  }, [intel.adaptive]);

  if (intel.loading && !intel.state) {
    return (
      <RequireData>
        <IntelligenceWorkspace>
          <div className="intelligence-model mx-auto max-w-5xl space-y-3">
            <div className="skeleton-shimmer h-32 rounded-xl" />
            <div className="skeleton-shimmer h-16 rounded-lg" />
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
  const confidenceLabel =
    intel.analytics.dataConfidence === "high"
      ? "high confidence"
      : intel.analytics.dataConfidence === "medium"
        ? "moderate confidence"
        : "low confidence";
  const trustLine = [`${runCount} runs`, dataSourceLabel ?? "Strava API", confidenceLabel].join(
    " · ",
  );

  const risks = intel.risksAndOpportunities.filter((r) => r.kind === "risk");
  const opportunities = intel.risksAndOpportunities.filter((r) => r.kind === "opportunity");

  return (
    <RequireData>
      <IntelligenceWorkspace>
        <div className="intelligence-model mx-auto max-w-5xl space-y-3 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-600">
              What StrideIQ currently believes, what changed, and what to investigate
            </p>
            <div className="flex gap-3 text-[11px]">
              <Link href="/plan" className="text-teal-500/90 hover:text-teal-300">
                Plan →
              </Link>
              <Link href={coachUrl()} className="text-zinc-500 hover:text-zinc-300">
                Coach →
              </Link>
            </div>
          </div>

          <IntelligenceHero
            state={intel.state}
            analytics={intel.analytics}
            primaryRecommendation={intel.primaryRecommendation}
            trustLine={trustLine}
          />

          {evolution.length > 0 ? <IntelligenceStateEvolution items={evolution} /> : null}

          <IntelligencePeriodNarratives
            monthly={intel.analytics.monthlyNarrative}
            preRace={intel.analytics.preRaceNarrative}
          />

          <IntelligenceDecisionSupport
            risks={risks}
            opportunities={opportunities}
            recommendation={intel.primaryRecommendation}
          />

          {intel.analytics.riskPatterns.length > 0 ? (
            <IntelligenceRiskPatterns patterns={intel.analytics.riskPatterns} />
          ) : null}

          <IntelligenceRecentlyLearned
            items={intel.recentlyLearned}
            adaptationSignals={intel.adaptationSignals}
          />

          {outcomes ? <IntelligenceRecommendationOutcomes data={outcomes} /> : null}

          {forecastAccuracy ? <IntelligenceForecastAccuracy data={forecastAccuracy} /> : null}

          <IntelligenceCapabilityRadar data={intel.analytics.capabilityRadar} />

          <IntelligenceProgressionBurndown data={intel.analytics.progressionBurndown} />

          <IntelligencePhysiology data={intel.analytics.physiology} />

          <IntelligenceMemoryGrouped memory={intel.memory} beliefsById={beliefsById} />

          <IntelligenceSignalBoard signals={intel.signals} compact />

          {intel.ecosystem ? <IntelligenceEcosystemCompact ecosystem={intel.ecosystem} /> : null}

          <IntelligenceCoachEntries domains={intel.state.domains} />
        </div>
      </IntelligenceWorkspace>
    </RequireData>
  );
}
