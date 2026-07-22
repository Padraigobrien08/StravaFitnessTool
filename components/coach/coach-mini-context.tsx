"use client";

import type { CoachWorkspaceState } from "@/lib/coach/types";
import { cn } from "@/lib/utils";
import { ChevronRight, Target } from "lucide-react";

function ContextRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-md bg-white/[0.025] px-2.5 py-2">
      <p className="text-[11px] text-zinc-600">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium tabular-nums text-zinc-300">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p> : null}
    </div>
  );
}

export function CoachMiniContext({
  state,
  collapsed,
  onToggle,
}: {
  state: CoachWorkspaceState;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { snapshot } = state;
  const topRisk = state.risksAndOpportunities.find((r) => r.kind === "risk");
  const topOpp = state.risksAndOpportunities.find((r) => r.kind === "opportunity");

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="coach-mini-context hidden h-full min-h-0 w-9 shrink-0 items-center justify-center self-stretch bg-[#0a0b0e]/80 xl:flex"
        aria-label="Expand context"
      >
        <ChevronRight className="h-4 w-4 rotate-180 text-zinc-600" />
      </button>
    );
  }

  return (
    <aside className="coach-mini-context hidden h-full min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden bg-[#0a0b0e]/50 xl:flex">
      <div className="flex shrink-0 items-center justify-between px-3 py-2.5">
        <span className="text-[12px] font-medium text-zinc-500">Answer context</span>
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-0.5 text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-400"
          aria-label="Collapse"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-3 text-[13px] leading-snug text-zinc-400">{snapshot.currentFocus}</p>

        <div className="grid grid-cols-2 gap-2">
          {snapshot.readinessScore != null ? (
            <ContextRow
              label="Readiness"
              value={snapshot.readinessScore}
              sub={snapshot.readinessLabel ?? undefined}
            />
          ) : null}
          {snapshot.freshness != null ? (
            <ContextRow
              label="Freshness"
              value={Math.round(snapshot.freshness)}
              sub={
                snapshot.tsb != null
                  ? `TSB ${snapshot.tsb > 0 ? "+" : ""}${Math.round(snapshot.tsb)}`
                  : (snapshot.fatigueLabel ?? undefined)
              }
            />
          ) : null}
        </div>

        {snapshot.raceLabel ? (
          <div className="mt-2 flex gap-2 rounded-md bg-white/[0.025] px-2.5 py-2">
            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <div>
              <p className="text-[11px] text-zinc-600">Race</p>
              <p className="text-[13px] text-zinc-300">{snapshot.raceLabel}</p>
              {snapshot.daysToRace != null ? (
                <p className="text-[11px] text-zinc-600">{snapshot.daysToRace} days out</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-[12px] text-zinc-500">
          Model confidence{" "}
          <span className="font-medium capitalize text-zinc-400">
            {snapshot.recommendationConfidence}
          </span>
        </p>

        {topRisk ? (
          <div className="mt-3 rounded-md border-l-2 border-amber-500/25 bg-amber-500/[0.04] px-2.5 py-2">
            <p className="text-[11px] text-amber-200/50">Risk</p>
            <p className="mt-0.5 text-[12px] leading-snug text-zinc-400">{topRisk.text}</p>
          </div>
        ) : null}

        {topOpp ? (
          <div className="mt-2 rounded-md border-l-2 border-teal-500/20 bg-teal-500/[0.03] px-2.5 py-2">
            <p className="text-[11px] text-teal-400/50">Opportunity</p>
            <p className="mt-0.5 text-[12px] leading-snug text-zinc-400">{topOpp.text}</p>
          </div>
        ) : null}

        {snapshot.weekLabel ? (
          <p className={cn("mt-3 text-[11px] text-zinc-600")}>
            {snapshot.weekLabel}
            {snapshot.last7Km > 0 ? ` · ${snapshot.last7Km.toFixed(0)} km (7d)` : ""}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
