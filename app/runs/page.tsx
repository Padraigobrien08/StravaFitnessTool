"use client";

import { useMemo, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import { buildRunsPageView } from "@/lib/runs/viewModels";
import { RunsWorkspace } from "@/components/runs/runs-workspace";
import { RunHistoryHero } from "@/components/runs/run-history-hero";
import { HistoricalContextPanel } from "@/components/runs/historical-context-panel";
import { RunExplorer } from "@/components/runs/run-explorer";
import { NotableSessionsFeed } from "@/components/runs/notable-sessions-feed";
import { SessionIntelligencePanel } from "@/components/runs/session-intelligence-panel";
import { RunsDataQualityPanel } from "@/components/runs/runs-data-quality-panel";
import { ActivityContextPanel } from "@/components/runs/activity-context-panel";
import { SegmentedControl, type SegmentedItem } from "@/components/ui/segmented-control";

type ViewMode = "explorer" | "intelligence" | "context";

const VIEW_MODES: SegmentedItem<ViewMode>[] = [
  { value: "intelligence", label: "Session intelligence" },
  { value: "explorer", label: "Activity explorer" },
  { value: "context", label: "Activity mix" },
];

export default function RunsPage() {
  const {
    importData,
    insights,
    fitRunIds,
    dataSourceLabel,
    loading: stravaLoading,
    getFitDetailForRun,
  } = useStrava();
  const { analytics, quality, loading } = useTrainingIntelligence();
  const [mode, setMode] = useState<ViewMode>("explorer");

  const view = useMemo(() => {
    if (!importData || !analytics) return null;
    return buildRunsPageView(importData.runs, analytics, fitRunIds, quality);
  }, [importData, analytics, fitRunIds, quality]);

  if ((loading || stravaLoading) && !view) {
    return (
      <div className="dashboard-enter w-full max-w-6xl space-y-3 pb-8">
        <div className="skeleton-shimmer h-8 w-48 rounded" />
        <div className="skeleton-shimmer h-36 rounded-xl" />
        <div className="skeleton-shimmer h-12 rounded-lg" />
        <div className="skeleton-shimmer h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <RequireData>
      {view && importData && analytics && (
        <RunsWorkspace className="max-w-6xl">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-teal-500/70">
                Activities · Explore your sessions
              </p>
              <p className="text-[11px] text-zinc-600">
                Interpret, explore, and compare individual runs
                {dataSourceLabel ? ` · ${dataSourceLabel}` : ""}
              </p>
            </div>
            <SegmentedControl
              items={VIEW_MODES}
              value={mode}
              onChange={setMode}
              ariaLabel="Activities view"
            />
          </header>

          <div className="space-y-3">
            <RunHistoryHero hero={view.hero} />
            <HistoricalContextPanel data={view.historical} />

            {mode === "intelligence" ? (
              <SessionIntelligencePanel
                sessions={view.intelligenceSessions}
                patterns={view.patterns}
              />
            ) : mode === "context" ? (
              <ActivityContextPanel
                activityMix={insights?.activityMix ?? []}
                monthlyVolume={insights?.monthlyVolume ?? []}
                totalActivities={importData.allActivities.length}
              />
            ) : (
              <>
                <section className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-3">
                  <p className="mb-2 text-[11px] font-medium text-zinc-500">
                    Ranked notable sessions
                  </p>
                  <NotableSessionsFeed sessions={view.notableSessions} compact />
                </section>
                <RunExplorer
                  rows={view.explorerRows}
                  runs={importData.runs}
                  analytics={analytics}
                  getFitForRun={getFitDetailForRun}
                />
              </>
            )}

            {mode === "context" ? null : <RunsDataQualityPanel data={view.quality} />}
          </div>
        </RunsWorkspace>
      )}
    </RequireData>
  );
}
