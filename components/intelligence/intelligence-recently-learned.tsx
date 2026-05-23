"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdaptationSignal } from "@/lib/adaptation-engine";
import { coachUrl } from "@/lib/coach/domainLinks";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function IntelligenceRecentlyLearned({
  items,
  adaptationSignals,
}: {
  items: string[];
  adaptationSignals: AdaptationSignal[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0 && adaptationSignals.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 4);
  const hiddenCount = items.length - visible.length;

  return (
    <section className="rounded-lg border border-teal-500/12 bg-teal-500/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-zinc-500">
          What the system recently learned
        </p>
        <Link
          href={coachUrl({ q: "What have you learned about me recently?" })}
          className="text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          Ask Coach
        </Link>
      </div>
      <ul className="mt-2 space-y-1.5">
        {visible.map((item) => (
          <li
            key={item.slice(0, 48)}
            className="flex gap-2 text-[12px] leading-snug text-zinc-400"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-500/50" />
            {item}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown className={cn("h-3 w-3", expanded && "rotate-180")} />
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </section>
  );
}
