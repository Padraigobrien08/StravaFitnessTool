"use client";

import { useMemo } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { buildTrainingPageView } from "@/lib/training/viewModels";
import { TrainingWorkspace, TrainingIntelRow } from "@/components/training/training-workspace";
import { TrainingStateHero } from "@/components/training/training-state-hero";
import { AdaptiveWeekPlan } from "@/components/training/adaptive-week-plan";
import { LoadIntelligencePanel } from "@/components/training/load-intelligence-panel";
import { CoachingExplainability } from "@/components/training/coaching-explainability";
import { AdaptationSignalsPanel } from "@/components/training/adaptation-signals-panel";
import { SupportingAnalytics } from "@/components/training/supporting-analytics";
import { TrainingEcosystemPanel } from "@/components/training/training-ecosystem-panel";
import { ops } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { dash } from "@/components/home/primitives/tokens";

function TrainingBriefingBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
      <div>
        <p className={dash.labelAccent}>Coaching workspace</p>
        <p className="mt-0.5 text-xs text-zinc-600">
          Adaptation · load · next week · evidence
        </p>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const { analytics, insights, loading } = useTrainingIntelligence();

  const view = useMemo(() => {
    if (!analytics) return null;
    return buildTrainingPageView(analytics, insights);
  }, [analytics, insights]);

  if (loading && !view) {
    return (
      <div className="dashboard-enter w-full space-y-4 pb-8">
        <div className="skeleton-shimmer h-10 w-full rounded-lg" />
        <div className="skeleton-shimmer h-44 w-full rounded-xl" />
        <div className="skeleton-shimmer h-64 w-full rounded-xl" />
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
        <TrainingWorkspace>
          <TrainingBriefingBar />
          <TrainingStateHero hero={view.hero} />
          <AdaptiveWeekPlan
            plan={view.plan}
            weekStart={analytics.nextWeekPlan.weekStart}
          />
          <TrainingIntelRow>
            <LoadIntelligencePanel
              data={view.load}
              className={cn(ops.intelMain)}
            />
            <CoachingExplainability
              data={view.explain}
              className={cn(ops.intelSide)}
            />
          </TrainingIntelRow>
          <AdaptationSignalsPanel data={view.adaptation} />
          <TrainingEcosystemPanel data={view.ecosystem} />
          <SupportingAnalytics data={view.supporting} />
        </TrainingWorkspace>
      )}
    </RequireData>
  );
}
