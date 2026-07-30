"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ActivityContextPanel } from "@/components/runs/activity-context-panel";
import { cn } from "@/lib/utils";

type ViewMode = "explorer" | "intelligence" | "context";

const VIEW_MODES: ViewMode[] = ["explorer", "intelligence", "context"];

function parseMode(raw: string | null): ViewMode {
  return VIEW_MODES.find((m) => m === raw) ?? "explorer";
}

function RunsPageSkeleton() {
  return (
    <div className="dashboard-enter w-full space-y-3 pb-8">
      <div className="skeleton-shimmer h-8 w-48 rounded" />
      <div className="skeleton-shimmer h-36 rounded-xl" />
      <div className="skeleton-shimmer h-12 rounded-lg" />
      <div className="skeleton-shimmer h-48 rounded-xl" />
    </div>
  );
}

// useSearchParams needs a Suspense boundary to keep /runs prerenderable.
export default function RunsPage() {
  return (
    <Suspense fallback={<RunsPageSkeleton />}>
      <RunsPageContent />
    </Suspense>
  );
}

function RunsPageContent() {
  const {
    importData,
    insights,
    fitRunIds,
    dataSourceLabel,
    loading: stravaLoading,
    getFitDetailForRun,
  } = useStrava();
  const { analytics, quality, loading } = useTrainingIntelligence();
  // View lives in the URL (?view=) so a chosen tab survives a refresh and can be
  // linked to, matching how /plan handles its tabs.
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = parseMode(searchParams.get("view"));
  const setMode = (next: ViewMode) => {
    router.replace(next === "explorer" ? "/runs" : `/runs?view=${next}`, { scroll: false });
  };

  const view = useMemo(() => {
    if (!importData || !analytics) return null;
    return buildRunsPageView(importData.runs, analytics, fitRunIds, quality);
  }, [importData, analytics, fitRunIds, quality]);

  if ((loading || stravaLoading) && !view) {
    return <RunsPageSkeleton />;
  }

  return (
    <RequireData>
      {view && importData && analytics && (
        <RunsWorkspace>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
            <div>
              <Eyebrow className="text-accent/80">Activities · Explore your sessions</Eyebrow>
              <p className="mt-1 text-[11px] text-zinc-600">
                Interpret, explore, and compare individual runs
                {dataSourceLabel ? ` · ${dataSourceLabel}` : ""}
              </p>
            </div>
            <div
              className="flex rounded-lg p-0.5 ring-1 ring-[var(--border-subtle)]"
              role="tablist"
              aria-label="Activities view"
            >
              <ModeButton active={mode === "intelligence"} onClick={() => setMode("intelligence")}>
                Session intelligence
              </ModeButton>
              <ModeButton active={mode === "explorer"} onClick={() => setMode("explorer")}>
                Activity explorer
              </ModeButton>
              <ModeButton active={mode === "context"} onClick={() => setMode("context")}>
                Activity mix
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
            ) : mode === "context" ? (
              <ActivityContextPanel
                activityMix={insights?.activityMix ?? []}
                monthlyVolume={insights?.monthlyVolume ?? []}
                totalActivities={importData.allActivities.length}
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

            {mode === "context" ? null : <RunsDataQualityPanel data={view.quality} />}
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
      role="tab"
      aria-selected={active}
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
