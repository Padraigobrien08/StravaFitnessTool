"use client";

import type { CoachWorkspaceState } from "@/lib/coach/types";
import { cn } from "@/lib/utils";
import { Radio, Sparkles } from "lucide-react";

const toneStyles = {
  positive: "border-accent/15 bg-accent/[0.06] text-accent/90",
  neutral: "border-white/[0.06] bg-white/[0.02] text-zinc-400",
  warning: "border-amber-500/20 bg-amber-500/[0.05] text-amber-100/85",
  opportunity: "border-blue-500/15 bg-blue-500/[0.05] text-blue-100/85",
};

export function CoachActivePresence({
  state,
  compact,
}: {
  state: CoachWorkspaceState;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "coach-presence relative overflow-hidden rounded-2xl border border-accent/10",
        compact ? "p-4" : "p-5 sm:p-6",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.08] via-transparent to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent/[0.04] blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent/90" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent/80">
              Active coaching focus
            </span>
          </div>
          <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
            {state.currentFocus}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">
            {state.focusRationale}
          </p>
        </div>
        {!compact ? (
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              Continuous reasoning
            </span>
            <span className="font-mono text-xs text-accent/70">
              {state.observations.length} live signals
            </span>
          </div>
        ) : null}
      </div>

      {!compact && state.observations.length > 0 ? (
        <ul className="relative mt-5 grid gap-2 sm:grid-cols-2">
          {state.observations.slice(0, 6).map((o) => (
            <li
              key={o.id}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-[13px] leading-snug",
                toneStyles[o.tone],
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider opacity-60">
                {o.domain}
                {o.isNew ? " · new" : ""}
              </span>
              <p className="mt-0.5">{o.text}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function CoachObservationStream({
  observations,
  max = 4,
}: {
  observations: CoachWorkspaceState["observations"];
  max?: number;
}) {
  if (observations.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        <Radio className="h-3 w-3 text-accent/60" />
        Active observations
      </p>
      <ul className="space-y-1.5">
        {observations.slice(0, max).map((o) => (
          <li
            key={o.id}
            className="flex gap-2 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2 text-xs text-zinc-400"
          >
            <Sparkles
              className={cn(
                "mt-0.5 h-3 w-3 shrink-0",
                o.tone === "positive"
                  ? "text-accent/70"
                  : o.tone === "warning"
                    ? "text-amber-500/70"
                    : "text-zinc-600",
              )}
            />
            <span>{o.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
