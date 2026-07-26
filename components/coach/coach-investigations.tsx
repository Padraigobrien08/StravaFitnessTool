"use client";

import type { ActiveInvestigation } from "@/lib/coach/types";
import { cn } from "@/lib/utils";
import { ArrowRight, Microscope } from "lucide-react";

export function CoachInvestigations({
  investigations,
  onSelect,
  disabled,
  compact,
}: {
  investigations: ActiveInvestigation[];
  onSelect: (query: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  if (investigations.length === 0) return null;

  return (
    <section className={cn("coach-investigations", compact && "space-y-2")}>
      <div className={cn(!compact && "mb-3")}>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          <Microscope className="h-3 w-3 text-accent/60" />
          Active investigations
        </p>
        {!compact ? (
          <p className="mt-0.5 text-xs text-zinc-600">
            Open a reasoning thread — the system already has context
          </p>
        ) : null}
      </div>
      <ul className={cn(compact ? "space-y-1" : "grid gap-2 sm:grid-cols-2")}>
        {investigations.map((inv, i) => (
          <li key={inv.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(inv.question)}
              className={cn(
                "group w-full rounded-lg border border-white/[0.06] bg-white/[0.02] text-left transition-all",
                "hover:border-accent/25 hover:bg-accent/[0.04] disabled:opacity-40",
                compact ? "px-2.5 py-2" : "px-3 py-3",
                !compact && i === 0 && "sm:col-span-2 border-accent/15 bg-accent/[0.03]",
              )}
            >
              <p
                className={cn(
                  "font-medium text-zinc-200 group-hover:text-white",
                  compact ? "text-xs" : "text-sm",
                )}
              >
                {inv.question}
              </p>
              <p
                className={cn(
                  "mt-1 text-zinc-600 line-clamp-2",
                  compact ? "text-[10px]" : "text-[11px]",
                )}
              >
                {inv.rationale}
              </p>
              {!compact ? (
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-accent/70 opacity-0 transition-opacity group-hover:opacity-100">
                  Investigate
                  <ArrowRight className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
