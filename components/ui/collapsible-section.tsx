"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Canonical show/hide disclosure. Consolidates the hand-rolled
 * "header button + rotating chevron + collapsible body" pattern.
 *
 * - `variant="divider"` (default): a hairline-separated sub-section, for
 *   stacking several collapses inside one panel.
 * - `variant="card"`: a bordered, tappable card header, for demoting a whole
 *   region behind one toggle.
 *
 * `summary` shows beside/under the title only while collapsed (a teaser).
 */
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  variant = "divider",
  className,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  variant?: "divider" | "card";
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (variant === "card") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.03]"
        >
          <span className="text-[12px] font-medium text-zinc-400">
            {title}
            {summary ? <span className="ml-1.5 font-normal text-zinc-600">{summary}</span> : null}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {open ? <div className="mt-3 space-y-3">{children}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("border-t border-white/[0.04] pt-4 first:border-0 first:pt-0", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <p className="text-xs font-semibold text-zinc-400">{title}</p>
          {summary && !open ? <p className="mt-0.5 text-[11px] text-zinc-600">{summary}</p> : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-600 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
