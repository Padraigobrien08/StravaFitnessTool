"use client";

import { useMemo } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { buildRunsPageView } from "@/lib/runs/viewModels";
import { RunsWorkspace } from "@/components/runs/runs-workspace";
import { RunHistoryHero } from "@/components/runs/run-history-hero";
import { TrainingDistributionSummary } from "@/components/runs/training-distribution-summary";
import { NotableSessionsFeed } from "@/components/runs/notable-sessions-feed";
import { RunExplorer } from "@/components/runs/run-explorer";
import { WorkoutPatternAnalysis } from "@/components/runs/workout-pattern-analysis";
import { HistoricalContextPanel } from "@/components/runs/historical-context-panel";
import { RunsDataQualityPanel } from "@/components/runs/runs-data-quality-panel";
import { dash } from "@/components/home/primitives/tokens";
import { useStrava } from "@/lib/context/strava-context";

function RunsBriefingBar({ dataSourceLabel }: { dataSourceLabel?: string }) {
  return (
    <div className="border-b border-white/[0.04] pb-3">
      <p className={dash.labelAccent}>Activity intelligence workspace</p>
      <p className="mt-0.5 text-xs text-zinc-600">
        Explore · interpret · pattern analysis
        {dataSourceLabel ? ` · ${dataSourceLabel}` : ""}
      </p>
    </div>
  );
}

export default function RunsPage() {
  const { importData, fitRunIds, dataSourceLabel, loading: stravaLoading } =
    useStrava();
  const { analytics, quality, loading } = useTrainingIntelligence();

  const view = useMemo(() => {
    if (!importData || !analytics) return null;
    return buildRunsPageView(
      importData.runs,
      analytics,
      fitRunIds,
      quality
    );
  }, [importData, analytics, fitRunIds, quality]);

  if ((loading || stravaLoading) && !view) {
    return (
      <div className="dashboard-enter w-full space-y-4 pb-8">
        <div className="skeleton-shimmer h-10 w-full rounded-lg" />
        <div className="skeleton-shimmer h-44 w-full rounded-xl" />
        <div className="skeleton-shimmer h-32 w-full rounded-xl" />
        <div className="skeleton-shimmer h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <RequireData>
      {view && importData && (
        <RunsWorkspace>
          <RunsBriefingBar dataSourceLabel={dataSourceLabel ?? undefined} />
          <RunHistoryHero hero={view.hero} />
          <TrainingDistributionSummary data={view.distribution} />
          <NotableSessionsFeed sessions={view.notableSessions} />
          <WorkoutPatternAnalysis patterns={view.patterns} />
          <RunExplorer rows={view.explorerRows} />
          <HistoricalContextPanel data={view.historical} />
          <RunsDataQualityPanel data={view.quality} />
        </RunsWorkspace>
      )}
    </RequireData>
  );
}
