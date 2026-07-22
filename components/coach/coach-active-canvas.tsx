"use client";

import type { CoachWorkspaceState } from "@/lib/coach/types";
import { CoachActivePresence, CoachObservationStream } from "./coach-active-presence";
import { CoachDomains } from "./coach-domains";
import { cn } from "@/lib/utils";
import { Clock, Pin } from "lucide-react";

export function CoachActiveCanvas({
  state,
  onExplore,
  disabled,
  hasConversation,
}: {
  state: CoachWorkspaceState;
  onExplore: (query: string) => void;
  disabled?: boolean;
  hasConversation: boolean;
}) {
  return (
    <div className={cn("coach-canvas space-y-5", hasConversation && "pb-2")}>
      <CoachActivePresence state={state} compact={hasConversation} />

      {!hasConversation ? (
        <>
          <TemporalStrip temporal={state.temporal} />
          <CoachMemoryPanel memory={state.memory} />
          <CoachDomains domains={state.domains} onExplore={onExplore} disabled={disabled} />
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <CoachObservationStream observations={state.observations} max={3} />
          <div className="space-y-3">
            {state.pinnedFromThread.length > 0 ? (
              <PinnedConclusions items={state.pinnedFromThread} />
            ) : state.lastAssistantSummary ? (
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                  Latest conclusion
                </p>
                <p className="mt-1 text-sm text-zinc-300">{state.lastAssistantSummary}</p>
              </div>
            ) : null}
            <CoachDomains
              domains={state.domains.slice(0, 4)}
              onExplore={onExplore}
              disabled={disabled}
              collapsed
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TemporalStrip({ temporal }: { temporal: CoachWorkspaceState["temporal"] }) {
  const items = [
    temporal.currentBlock,
    temporal.raceCountdown,
    temporal.weekTransition,
    temporal.fatigueRecovery,
  ].filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2.5">
      <Clock className="h-3.5 w-3.5 text-zinc-600" />
      {items.map((t, i) => (
        <span
          key={i}
          className="text-[11px] text-zinc-500 after:ml-2 after:text-zinc-700 last:after:content-none after:content-['·']"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function CoachMemoryPanel({ memory }: { memory: CoachWorkspaceState["memory"] }) {
  if (memory.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Longitudinal memory
      </p>
      <p className="mt-1 text-xs text-zinc-600 mb-4">
        Patterns retained across blocks — not reset each session
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {memory.map((m) => (
          <li key={m.id} className="rounded-lg border border-white/[0.04] bg-black/25 px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-teal-500/70">
              {m.label}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{m.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PinnedConclusions({ items }: { items: CoachWorkspaceState["pinnedFromThread"] }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
        <Pin className="h-3 w-3" />
        Recent conclusions
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((p) => (
          <li key={p.id} className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-300">{p.title}</span>
            {p.summary ? <span className="block mt-0.5 line-clamp-2">{p.summary}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
