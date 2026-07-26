"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { Eyebrow, Panel } from "@/components/console/console-kit";
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
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
            <div>
              <Eyebrow className="text-accent/80">Activities · Explore your sessions</Eyebrow>
              <p className="mt-1 text-[11px] text-zinc-600">
                Interpret, explore, and compare individual runs · intensity &amp; load breakdown on{" "}
                <Link href="/training" className="text-zinc-500 hover:text-accent">
                  Training
                </Link>
                {dataSourceLabel ? ` · ${dataSourceLabel}` : ""}
              </p>
            </div>
            <div className="flex rounded-lg p-0.5 ring-1 ring-[var(--border-subtle)]">
              <ModeButton active={mode === "intelligence"} onClick={() => setMode("intelligence")}>
                Session intelligence
              </ModeButton>
              <ModeButton active={mode === "explorer"} onClick={() => setMode("explorer")}>
                Activity explorer
              </ModeButton>
            </div>
          </header>

          <div className="space-y-3">
            <RunHistoryHero hero={view.hero} />
            <HistoricalContextPanel data={view.historical} />

            {mode === "intelligence" ? (
              <SessionIntelligencePanel
                sessions={view.intelligenceSessions}
                patterns={view.patterns}
              />
            ) : (
              <>
                <Panel>
                  <Eyebrow className="mb-2">Ranked notable sessions</Eyebrow>
                  <NotableSessionsFeed sessions={view.notableSessions} compact />
                </Panel>
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
        active ? "bg-accent/15 text-accent" : "text-zinc-500 hover:text-zinc-300",
      )}
    >
      {children}
    </button>
  );
}
