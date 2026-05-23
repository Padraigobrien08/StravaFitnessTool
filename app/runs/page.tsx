"use client";

import { useMemo, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import { buildRunsPageView } from "@/lib/runs/viewModels";
import { RunsWorkspace } from "@/components/runs/runs-workspace";
import { ActivityStateSummary } from "@/components/runs/activity-state-summary";
import { RunHistoryHero } from "@/components/runs/run-history-hero";
import { TrainingDistributionSummary } from "@/components/runs/training-distribution-summary";
import { HistoricalContextPanel } from "@/components/runs/historical-context-panel";
import { RunExplorer } from "@/components/runs/run-explorer";
import { NotableSessionsFeed } from "@/components/runs/notable-sessions-feed";
import { SessionIntelligencePanel } from "@/components/runs/session-intelligence-panel";
import { RunsDataQualityPanel } from "@/components/runs/runs-data-quality-panel";
import { cn } from "@/lib/utils";

type ViewMode = "explorer" | "intelligence";

export default function RunsPage() {
  const {
    importData,
    fitRunIds,
    dataSourceLabel,
    loading: stravaLoading,
    getFitDetailForRun,
  } = useStrava();
  const { analytics, quality, loading } = useTrainingIntelligence();
  const [mode, setMode] = useState<ViewMode>("explorer");

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
                Session intelligence workspace
              </p>
              <p className="text-[11px] text-zinc-600">
                Interpret · explore · compare
                {dataSourceLabel ? ` · ${dataSourceLabel}` : ""}
              </p>
            </div>
            <div className="flex rounded-lg border border-white/[0.06] p-0.5">
              <ModeButton
                active={mode === "intelligence"}
                onClick={() => setMode("intelligence")}
              >
                Session intelligence
              </ModeButton>
              <ModeButton
                active={mode === "explorer"}
                onClick={() => setMode("explorer")}
              >
                Activity explorer
              </ModeButton>
            </div>
          </header>

          <div className="space-y-3">
            <ActivityStateSummary data={view.activityState} />
            <RunHistoryHero hero={view.hero} />
            <TrainingDistributionSummary data={view.distribution} />
            <HistoricalContextPanel data={view.historical} />

            {mode === "intelligence" ? (
              <SessionIntelligencePanel
                sessions={view.intelligenceSessions}
                patterns={view.patterns}
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

            <RunsDataQualityPanel data={view.quality} />
          </div>
        </RunsWorkspace>
      )}
    </RequireData>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
        active
          ? "bg-teal-500/15 text-teal-200"
          : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {children}
    </button>
  );
}
