"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlanExplainability({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]/40 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[11px] font-medium text-zinc-500">
          Why these sessions?
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-600", open && "rotate-180")} />
      </button>
      {open ? (
        <ul className="mt-2 space-y-1 border-t border-[var(--border-subtle)] pt-2">
          {lines.map((line) => (
            <li key={line} className="text-[11px] leading-snug text-zinc-500">
              · {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
