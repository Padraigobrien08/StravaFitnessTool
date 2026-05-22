"use client";

import { useMemo } from "react";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useCoachThread } from "@/hooks/use-coach-thread";
import { useGoalStore } from "@/stores/goal-store";
import { buildCoachWorkspaceState } from "@/lib/coach/viewModel";
import { CoachIntelligenceModel } from "./coach-intelligence-model";
import { CoachReasoningThread } from "./coach-reasoning-thread";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export function CoachReasoningWorkspace({
  disabled,
  disabledReason,
}: {
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { analytics, insights, loading: dataLoading } = useTrainingIntelligence();
  const raceGoal = useGoalStore((s) => s.raceGoal);

  const thread = useCoachThread(disabled);

  const workspace = useMemo(
    () =>
      analytics
        ? buildCoachWorkspaceState(
            analytics,
            insights,
            raceGoal,
            thread.messages
          )
        : null,
    [analytics, insights, raceGoal, thread.messages]
  );

  const composerPlaceholder = useMemo(() => {
    if (!workspace) return "Connect data to activate coaching intelligence…";
    return `Investigate ${workspace.currentFocus.toLowerCase()}…`;
  }, [workspace]);

  return (
    <div className="coach-terminal flex min-h-[calc(100dvh-6.5rem)] flex-col overflow-hidden rounded-xl border border-white/[0.06] shadow-[0_40px_120px_-56px_rgba(0,0,0,0.95)]">
      <header className="coach-terminal-header relative flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-teal-500/[0.05] via-transparent to-transparent"
          aria-hidden
        />
        <div className="relative min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-teal-400/80">
            Endurance reasoning workspace
          </p>
          <h1 className="font-display text-base font-bold text-white sm:text-lg">
            StrideIQ Coach
          </h1>
          {workspace ? (
            <p className="truncate text-[11px] text-zinc-600">
              {workspace.observations.length} live signals ·{" "}
              {workspace.investigations.length} open investigations
            </p>
          ) : null}
        </div>
        <div className="relative hidden items-center gap-2 sm:flex">
          <span className="rounded-md border border-teal-500/20 bg-teal-500/[0.08] px-2 py-1 text-[10px] font-medium text-teal-300/90">
            Continuously reasoning
          </span>
        </div>
      </header>

      <div className="coach-split flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          className={cn(
            "coach-intel-pane min-h-[320px] min-w-0 border-b border-white/[0.06] lg:border-b-0 lg:border-r",
            "lg:w-[68%] lg:max-w-[68%] lg:flex-[0_0_68%]"
          )}
        >
          {workspace && !dataLoading ? (
            <CoachIntelligenceModel
              state={workspace}
              onExplore={(q) => void thread.send(q)}
              disabled={disabled}
            />
          ) : dataLoading ? (
            <IntelligenceSkeleton />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-600">
              Load training data to activate the intelligence model.
            </div>
          )}
        </section>

        <section
          className={cn(
            "coach-thread-pane min-h-[360px] min-w-0",
            "lg:w-[32%] lg:max-w-[32%] lg:flex-[0_0_32%]"
          )}
        >
          {workspace && !dataLoading ? (
            <CoachReasoningThread
              workspace={workspace}
              threads={thread.threads}
              activeId={thread.activeId}
              messages={thread.messages}
              input={thread.input}
              setInput={thread.setInput}
              loading={thread.loading}
              error={thread.error}
              pendingTools={thread.pendingTools}
              loadingPhase={thread.loadingPhase}
              scrollRef={thread.scrollRef}
              onSend={(t) => void thread.send(t)}
              onNewThread={thread.handleNewThread}
              onSelectThread={thread.loadThread}
              onDeleteThread={thread.handleDeleteThread}
              disabled={disabled}
              disabledReason={disabledReason}
              composerPlaceholder={composerPlaceholder}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-xs text-zinc-600">
              Reasoning thread activates with synced data.
            </div>
          )}
        </section>
      </div>

      {disabled ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-amber-500/15 bg-amber-500/[0.06] px-4 py-2 text-[11px] text-amber-200/85 lg:hidden">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{disabledReason}</span>
        </div>
      ) : null}
    </div>
  );
}

function IntelligenceSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <div className="skeleton-shimmer h-24 w-full rounded-2xl" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="skeleton-shimmer h-32 rounded-xl" />
        <div className="skeleton-shimmer h-32 rounded-xl" />
      </div>
      <div className="skeleton-shimmer h-40 rounded-xl" />
    </div>
  );
}
