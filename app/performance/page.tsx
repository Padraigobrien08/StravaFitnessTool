"use client";

import { useMemo, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import { useGoalStore } from "@/stores/goal-store";
import { buildPerformancePageView } from "@/lib/performance/viewModels";
import { buildForecastV2View } from "@/lib/goals/forecastV2ViewModel";
import type { RaceDistance } from "@/lib/analytics/readiness";
import { PerformanceWorkspace } from "@/components/performance/performance-workspace";
import { PerformanceStateHero } from "@/components/performance/performance-state-hero";
import { PerformanceTrajectoryPanel } from "@/components/performance/performance-trajectory-panel";
import { RaceProjectionPanel } from "@/components/performance/race-projection-panel";
import { AdaptationTrendsPanel } from "@/components/performance/adaptation-trends-panel";
import { PerformanceIntegrityPanel } from "@/components/performance/performance-integrity-panel";
import { dash } from "@/components/home/primitives/tokens";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { JargonTerm } from "@/components/jargon-term";

const RACE_DISTANCE_KM: Record<RaceDistance, number> = {
  "5k": 5,
  "10k": 10,
  hm: 21.0975,
  marathon: 42.195,
};

function PerformanceEvidenceBanner() {
  return (
    <div className="border-b border-white/[0.04] pb-3">
      <p className={dash.labelAccent}>Performance · Am I improving?</p>
      <p className="mt-0.5 text-xs text-zinc-600">
        Trajectory, <JargonTerm term="adaptation">adaptation</JargonTerm>, and projected outcome:
        the evidence you&apos;re getting fitter.
      </p>
    </div>
  );
}

export default function PerformancePage() {
  const { analytics, insights, quality, loading } = useTrainingIntelligence();
  const { importData, fitDetails } = useStrava();
  const raceGoal = useGoalStore((s) => s.raceGoal);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const view = useMemo(() => {
    if (!analytics) return null;
    // Use the canonical forecastV2 (same engine as Goals) so the headline race
    // projection agrees across surfaces instead of diverging from Goals.
    const forecast = buildForecastV2View({
      analytics,
      goal: raceGoal,
      runs: importData?.runs,
      fitDetails,
    });
    const goalDistanceKm = raceGoal ? RACE_DISTANCE_KM[raceGoal.distance] : null;
    return buildPerformancePageView(analytics, insights, quality, { forecast, goalDistanceKm });
  }, [analytics, insights, quality, raceGoal, importData?.runs, fitDetails]);

  if (loading && !view) {
    return (
      <div className="dashboard-enter w-full max-w-5xl space-y-4 pb-8">
        <div className="skeleton-shimmer h-10 w-full rounded-lg" />
        <div className="skeleton-shimmer h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <RequireData>
      {view && analytics && (
        <PerformanceWorkspace className="max-w-5xl">
          <PerformanceEvidenceBanner />
          <PerformanceStateHero hero={view.hero} />
          <PerformanceTrajectoryPanel data={view.progression} prTimeline={analytics.prTimeline} />
          <RaceProjectionPanel
            projection={view.projection}
            predictionTimeline={analytics.predictionTimeline}
          />

          <div className="rounded-lg border border-white/[0.04] bg-white/[0.015]">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
            >
              <span className="text-[12px] text-zinc-500">
                Advanced analytics (integrity, detailed trends)
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-zinc-600 transition-transform",
                  advancedOpen && "rotate-180",
                )}
              />
            </button>
            {advancedOpen ? (
              <div className="space-y-4 border-t border-white/[0.04] px-4 pb-4 pt-3">
                <AdaptationTrendsPanel trends={view.adaptationTrends} />
                <PerformanceIntegrityPanel data={view.integrity} />
              </div>
            ) : null}
          </div>
        </PerformanceWorkspace>
      )}
    </RequireData>
  );
}
