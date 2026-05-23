"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlanWeekNav({
  weekRange,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  className,
}: {
  weekRange: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)]/40 px-2 py-1",
        className
      )}
    >
      <button
        type="button"
        aria-label="Previous week"
        disabled={!canPrev}
        onClick={onPrev}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors",
          canPrev ? "hover:bg-white/[0.06] hover:text-zinc-300" : "opacity-30"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="min-w-0 flex-1 truncate text-center text-[11px] font-medium text-zinc-400">
        {weekRange}
      </p>
      <button
        type="button"
        aria-label="Next week"
        disabled={!canNext}
        onClick={onNext}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors",
          canNext ? "hover:bg-white/[0.06] hover:text-zinc-300" : "opacity-30"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
