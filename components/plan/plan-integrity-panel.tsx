"use client";

import { cn } from "@/lib/utils";
import type { PlanIntegrityItem } from "@/lib/plan/planWorkspaceView";
import { Eyebrow } from "@/components/console/console-kit";

const levelStyles = {
  info: "text-zinc-400 border-zinc-600/30 bg-zinc-500/[0.04]",
  warning: "text-amber-200/85 border-amber-500/25 bg-amber-500/[0.06]",
  critical: "text-red-200/90 border-red-500/30 bg-red-500/[0.08]",
};

export function PlanIntegrityPanel({
  items,
  onHighlightWorkouts,
}: {
  items: PlanIntegrityItem[];
  onHighlightWorkouts?: (ids: string[]) => void;
}) {
  if (items.length === 0) {
    return (
      <div>
        <Eyebrow>Integrity</Eyebrow>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--home-good)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--home-good)]" />
          All operational checks passed for this week.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Eyebrow>Integrity</Eyebrow>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={!item.workoutIds.length}
              onClick={() => onHighlightWorkouts?.(item.workoutIds)}
              className={cn(
                "w-full rounded-md border px-2 py-1.5 text-left transition-colors",
                levelStyles[item.level],
                item.workoutIds.length && "hover:brightness-110 cursor-pointer",
              )}
            >
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em]">
                {item.level}
              </span>
              <p className="mt-0.5 text-[11px] leading-snug">{item.message}</p>
              {item.workoutIds.length > 0 ? (
                <p className="mt-0.5 text-[9px] opacity-70">Tap to highlight affected sessions</p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
