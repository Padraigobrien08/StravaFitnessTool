"use client";

import { cn } from "@/lib/utils";
import type { PlanIntegrityItem } from "@/lib/plan/planWorkspaceView";

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
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          Integrity
        </p>
        <p className="mt-1 text-[11px] text-teal-400/80">
          All operational checks passed for this week.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
        Integrity
      </p>
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
                item.workoutIds.length && "hover:brightness-110 cursor-pointer"
              )}
            >
              <span className="text-[9px] font-semibold uppercase">
                {item.level}
              </span>
              <p className="mt-0.5 text-[11px] leading-snug">{item.message}</p>
              {item.workoutIds.length > 0 ? (
                <p className="mt-0.5 text-[9px] opacity-70">
                  Tap to highlight affected sessions
                </p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
