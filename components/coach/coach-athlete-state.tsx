"use client";

import { useState } from "react";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import { CoachDomainChips } from "./coach-domain-chips";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const toneIcon = {
  positive: Check,
  neutral: TrendingUp,
  warning: AlertTriangle,
  opportunity: Sparkles,
};

const toneClass = {
  positive: "text-teal-400/90",
  neutral: "text-zinc-500",
  warning: "text-amber-400/90",
  opportunity: "text-teal-300/80",
};

function compactMemoryLine(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function CoachAthleteState({
  state,
  activeDomainId,
  onDomainSelect,
  onRiskOpportunityClick,
  disabled,
  className,
}: {
  state: CoachWorkspaceState;
  activeDomainId: string | null;
  onDomainSelect: (domain: CoachWorkspaceState["domains"][0]) => void;
  onRiskOpportunityClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [memoryOpen, setMemoryOpen] = useState(false);
  const risks = state.risksAndOpportunities.filter((r) => r.kind === "risk");
  const opps = state.risksAndOpportunities.filter((r) => r.kind === "opportunity");

  const statusLine = [
    state.snapshot.freshness != null
      ? `Freshness ${state.snapshot.freshness}`
      : null,
    state.snapshot.riskLevel !== "low" ? state.snapshot.riskLabel : null,
    state.snapshot.recommendationConfidence
      ? `${state.snapshot.recommendationConfidence} confidence`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside
      className={cn(
        "coach-athlete-state flex h-full min-h-0 flex-col text-zinc-500",
        className
      )}
    >
      <div className="coach-athlete-scroll flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 space-y-4">
        <section>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
            Current state
          </p>
          <h2 className="mt-1 font-display text-base font-semibold text-zinc-200">
            {state.currentFocus}
          </h2>
          {statusLine ? (
            <p className="mt-1 text-[11px] leading-snug text-zinc-600">
              {statusLine}
            </p>
          ) : null}
        </section>

        {state.observations.length > 0 ? (
          <section>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              Key signals
            </p>
            <ul className="space-y-1.5">
              {state.observations.slice(0, 5).map((o) => {
                const Icon = toneIcon[o.tone];
                return (
                  <li
                    key={o.id}
                    className="flex gap-2 text-[11px] leading-snug text-zinc-500"
                  >
                    <Icon
                      className={cn("mt-0.5 h-3 w-3 shrink-0", toneClass[o.tone])}
                    />
                    <span>{o.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {state.memory.length > 0 ? (
          <section>
            <button
              type="button"
              onClick={() => setMemoryOpen((o) => !o)}
              className="flex w-full items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-600"
            >
              Memory
              {memoryOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            <ul className="mt-2 space-y-1.5">
              {(memoryOpen ? state.memory : state.memory.slice(0, 3)).map(
                (m) => (
                  <li key={m.id} className="text-[11px] leading-snug">
                    <span className="text-zinc-600">{m.label}: </span>
                    <span className="text-zinc-500">
                      {compactMemoryLine(m.text, memoryOpen ? 200 : 56)}
                    </span>
                  </li>
                )
              )}
            </ul>
          </section>
        ) : null}

        <section>
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
            Domains
          </p>
          <CoachDomainChips
            domains={state.domains}
            activeDomainId={activeDomainId}
            onSelect={onDomainSelect}
            disabled={disabled}
          />
        </section>

        {state.risksAndOpportunities.length > 0 ? (
          <section>
            <button
              type="button"
              onClick={onRiskOpportunityClick}
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-400"
            >
              Risks / opportunities
            </button>
            <p className="mt-1 text-[11px] text-zinc-600">
              {risks.length} risk{risks.length !== 1 ? "s" : ""} · {opps.length}{" "}
              opportunit{opps.length !== 1 ? "ies" : "y"}
            </p>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

/** Mobile collapsible wrapper */
export function CoachAthleteStateDrawer({
  state,
  activeDomainId,
  onDomainSelect,
  onExplore,
  disabled,
}: {
  state: CoachWorkspaceState;
  activeDomainId: string | null;
  onDomainSelect: (domain: CoachWorkspaceState["domains"][0]) => void;
  onExplore: (q: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="coach-athlete-drawer border-b border-white/[0.06] lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-xs font-medium text-zinc-400">
          Athlete state · {state.currentFocus}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-zinc-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-600" />
        )}
      </button>
      {open ? (
        <div className="max-h-[40vh] overflow-y-auto border-t border-white/[0.04]">
          <CoachAthleteState
            state={state}
            activeDomainId={activeDomainId}
            onDomainSelect={(d) => {
              onDomainSelect(d);
              onExplore(d.suggestedQuery);
              setOpen(false);
            }}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}
