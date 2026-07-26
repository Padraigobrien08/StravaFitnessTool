"use client";

import type { PlanTodayFocus } from "@/lib/plan/planWorkspaceView";
import { cn } from "@/lib/utils";

export function PlanTodayFocus({
  today,
  className,
  sticky = false,
}: {
  today: PlanTodayFocus;
  className?: string;
  /** Pin below app header on mobile while scrolling the plan page */
  sticky?: boolean;
}) {
  return (
    <div
      style={{ background: "var(--home-signal-wash)" }}
      className={cn(
        "rounded-lg px-3 py-2.5 ring-1 ring-[var(--home-signal-line)] backdrop-blur-md",
        sticky && "sticky top-[52px] z-30 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.65)]",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
        Today in this plan
      </p>
      <p className="mt-1 text-[13px] font-medium text-zinc-200">{today.title}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        <span className="text-zinc-600">Focus: </span>
        {today.focus}
      </p>
      {today.avoid ? (
        <p className="mt-1 text-[11px] text-amber-200/70">
          <span className="text-amber-400/60">Avoid: </span>
          {today.avoid}
        </p>
      ) : null}
    </div>
  );
}
