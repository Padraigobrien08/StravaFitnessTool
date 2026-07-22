"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { buildPerformancePageView } from "@/lib/performance/viewModels";
import {
  PerformanceWorkspace,
  PerformanceIntelRow,
} from "@/components/performance/performance-workspace";
import { PerformanceStateHero } from "@/components/performance/performance-state-hero";
import { PerformanceTrajectoryPanel } from "@/components/performance/performance-trajectory-panel";
import { RaceProjectionPanel } from "@/components/performance/race-projection-panel";
import { AdaptationTrendsPanel } from "@/components/performance/adaptation-trends-panel";
import { PerformanceDistributionPanel } from "@/components/performance/performance-distribution-panel";
import { PerformanceIntegrityPanel } from "@/components/performance/performance-integrity-panel";
import { dash } from "@/components/home/primitives/tokens";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function PerformanceEvidenceBanner() {
  return (
    <div className="border-b border-white/[0.04] pb-3">
      <p className={dash.labelAccent}>Performance evidence</p>
      <p className="mt-0.5 text-xs text-zinc-600">
        Validate forecasts and trends behind recommendations —{" "}
        <Link href="/plan" className="text-zinc-500 hover:text-zinc-400">
          plan
        </Link>
        {" · "}
        <Link href="/intelligence" className="text-zinc-500 hover:text-zinc-400">
          intelligence
        </Link>
      </p>
    </div>
  );
}

export default function PerformancePage() {
  const { analytics, insights, quality, loading } = useTrainingIntelligence();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const view = useMemo(() => {
    if (!analytics) return null;
    return buildPerformancePageView(analytics, insights, quality);
  }, [analytics, insights, quality]);

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
                Advanced analytics (distribution, integrity, detailed trends)
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
                <PerformanceIntelRow>
                  <div className="lg:col-span-7">
                    <PerformanceDistributionPanel data={view.distribution} />
                  </div>
                  <div className="lg:col-span-5">
                    <PerformanceIntegrityPanel data={view.integrity} />
                  </div>
                </PerformanceIntelRow>
              </div>
            ) : null}
          </div>
        </PerformanceWorkspace>
      )}
    </RequireData>
  );
}
