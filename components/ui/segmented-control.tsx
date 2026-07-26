"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedItem<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
};

/**
 * One canonical in-page view switch. Used for Plan's week/goal tabs and the
 * Activities view toggle so the same affordance reads the same everywhere.
 * Icons are optional — omit them for text-only switches.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex w-fit rounded-lg border border-[var(--border-subtle)] p-0.5", className)}
    >
      {items.map(({ value: itemValue, label, icon: Icon }) => {
        const active = itemValue === value;
        return (
          <button
            key={itemValue}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(itemValue)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-teal-500/15 text-teal-200"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
