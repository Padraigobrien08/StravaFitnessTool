"use client";

import { useMemo } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { buildPerformancePageView } from "@/lib/performance/viewModels";
import {
  PerformanceWorkspace,
  PerformanceIntelRow,
} from "@/components/performance/performance-workspace";
import { PerformanceStateHero } from "@/components/performance/performance-state-hero";
import { PerformanceTrajectoryPanel } from "@/components/performance/performance-trajectory-panel";
import { AchievementTimeline } from "@/components/performance/achievement-timeline";
import { RaceProjectionPanel } from "@/components/performance/race-projection-panel";
import { AdaptationTrendsPanel } from "@/components/performance/adaptation-trends-panel";
import { PerformanceDistributionPanel } from "@/components/performance/performance-distribution-panel";
import { PerformanceIntegrityPanel } from "@/components/performance/performance-integrity-panel";
import { dash } from "@/components/home/primitives/tokens";

function PerformanceBriefingBar() {
  return (
    <div className="border-b border-white/[0.04] pb-3">
      <p className={dash.labelAccent}>Performance intelligence</p>
      <p className="mt-0.5 text-xs text-zinc-600">
        Trajectory · projections · milestones · evidence
      </p>
    </div>
  );
}

export default function PerformancePage() {
  const { analytics, insights, quality, loading } = useTrainingIntelligence();

  const view = useMemo(() => {
    if (!analytics) return null;
    return buildPerformancePageView(analytics, insights, quality);
  }, [analytics, insights, quality]);

  if (loading && !view) {
    return (
      <div className="dashboard-enter w-full space-y-4 pb-8">
        <div className="skeleton-shimmer h-10 w-full rounded-lg" />
        <div className="skeleton-shimmer h-48 w-full rounded-xl" />
        <div className="skeleton-shimmer h-72 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton-shimmer h-56 rounded-xl" />
          <div className="skeleton-shimmer h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <RequireData>
      {view && analytics && (
        <PerformanceWorkspace>
          <PerformanceBriefingBar />
          <PerformanceStateHero hero={view.hero} />
          <PerformanceTrajectoryPanel
            data={view.progression}
            prTimeline={analytics.prTimeline}
          />
          <AchievementTimeline milestones={view.milestones} />
          <RaceProjectionPanel
            projection={view.projection}
            predictionTimeline={analytics.predictionTimeline}
          />
          <AdaptationTrendsPanel trends={view.adaptationTrends} />
          <PerformanceIntelRow>
            <div className="lg:col-span-7">
              <PerformanceDistributionPanel data={view.distribution} />
            </div>
            <div className="lg:col-span-5">
              <PerformanceIntegrityPanel data={view.integrity} />
            </div>
          </PerformanceIntelRow>
        </PerformanceWorkspace>
      )}
    </RequireData>
  );
}
