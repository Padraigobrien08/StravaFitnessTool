"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel } from "@/components/console/console-kit";

export function PlanExplainability({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;

  return (
    <Panel className="px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Eyebrow>Why these sessions?</Eyebrow>
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
    </Panel>
  );
}
