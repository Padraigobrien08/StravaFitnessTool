"use client";

import type { CoachWorkspaceState } from "@/lib/coach/types";
import { CoachActivePresence, CoachObservationStream } from "./coach-active-presence";
import { CoachDomains } from "./coach-domains";
import { CoachRisksOpportunities } from "./coach-risks-opportunities";
import { CoachInvestigations } from "./coach-investigations";
import { cn } from "@/lib/utils";
import { Clock, History, Pin } from "lucide-react";

export function CoachIntelligenceModel({
  state,
  onExplore,
  disabled,
}: {
  state: CoachWorkspaceState;
  onExplore: (query: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="coach-intel-model flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/[0.05] px-4 py-3 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-400/75">
          Athlete intelligence model
        </p>
        <p className="mt-0.5 text-xs text-zinc-600">
          Persistent reasoning state · updates as your training evolves
        </p>
      </div>

      <div className="coach-intel-scroll flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
        <div className="coach-intel-grid space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <CoachActivePresence state={state} />
            <div className="coach-intel-obs-panel rounded-2xl border border-white/[0.05] bg-black/25 p-4">
              <CoachObservationStream
                observations={state.observations}
                max={6}
              />
              {state.temporal.weekTransition || state.temporal.fatigueRecovery ? (
                <TemporalMini temporal={state.temporal} />
              ) : null}
            </div>
          </div>

          <CoachRisksOpportunities items={state.risksAndOpportunities} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <MemoryLayer memory={state.memory} />
            <ContinuityPanel
              temporal={state.temporal}
              pinned={state.pinnedFromThread}
              continuityLine={state.continuityLine}
            />
          </div>

          <CoachDomains
            domains={state.domains}
            onExplore={onExplore}
            disabled={disabled}
          />

          <CoachInvestigations
            investigations={state.investigations}
            onSelect={onExplore}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

function TemporalMini({
  temporal,
}: {
  temporal: CoachWorkspaceState["temporal"];
}) {
  const items = [
    temporal.weekTransition,
    temporal.fatigueRecovery,
    temporal.raceCountdown,
  ].filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="mt-4 border-t border-white/[0.04] pt-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
        <Clock className="h-3 w-3" />
        Temporal
      </p>
      <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function MemoryLayer({
  memory,
}: {
  memory: CoachWorkspaceState["memory"];
}) {
  if (memory.length === 0) return null;
  return (
    <div className="coach-memory-layer rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        <History className="h-3 w-3 text-teal-500/50" />
        Longitudinal memory
      </p>
      <p className="mt-1 text-xs text-zinc-600 mb-3">
        Patterns retained across blocks — beliefs evolve, not reset
      </p>
      <ul className="space-y-2.5">
        {memory.map((m, i) => (
          <li
            key={m.id}
            className={cn(
              "rounded-lg border border-white/[0.04] px-3 py-2.5",
              i === 0 && "border-teal-500/12 bg-teal-500/[0.03]"
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-teal-500/60">
              {m.label}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{m.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContinuityPanel({
  temporal,
  pinned,
  continuityLine,
}: {
  temporal: CoachWorkspaceState["temporal"];
  pinned: CoachWorkspaceState["pinnedFromThread"];
  continuityLine: string | null;
}) {
  return (
    <div className="coach-continuity rounded-2xl border border-white/[0.05] bg-[#0c0d10]/80 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Phase context
      </p>
      {temporal.currentBlock ? (
        <p className="mt-2 font-display text-sm font-semibold text-zinc-200">
          {temporal.currentBlock}
        </p>
      ) : null}
      {continuityLine ? (
        <p className="mt-3 text-xs leading-relaxed text-teal-200/70 border-l-2 border-teal-500/30 pl-3">
          {continuityLine}
        </p>
      ) : null}
      {pinned.length > 0 ? (
        <div className="mt-4 border-t border-white/[0.04] pt-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-600">
            <Pin className="h-3 w-3" />
            Thread memory
          </p>
          <ul className="mt-2 space-y-2">
            {pinned.slice(0, 2).map((p) => (
              <li key={p.id} className="text-[11px] text-zinc-500">
                <span className="text-zinc-300">{p.title}</span>
                {p.summary ? (
                  <span className="block mt-0.5 line-clamp-2">{p.summary}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
