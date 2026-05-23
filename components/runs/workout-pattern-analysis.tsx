"use client";

import Link from "next/link";
import { useState } from "react";
import type { PatternInsightView } from "@/lib/runs/viewModels";
import { coachUrl } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const toneBorder = {
  positive: "border-teal-500/15",
  neutral: "border-white/[0.05]",
  warning: "border-amber-500/20",
};

export function WorkoutPatternAnalysis({
  patterns,
}: {
  patterns: PatternInsightView[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section>
      <p className="mb-2 text-[11px] font-medium text-zinc-500">
        Evolving observations
      </p>
      <ul className="space-y-1.5">
        {patterns.map((p) => {
          const open = expanded === p.id;
          return (
            <li
              key={p.id}
              className={cn(
                "rounded-lg border bg-white/[0.015] px-3 py-2",
                toneBorder[p.tone]
              )}
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 text-left"
                onClick={() => setExpanded(open ? null : p.id)}
              >
                <div>
                  <p className="text-[12px] font-medium text-zinc-300">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                    {p.body}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600",
                    open && "rotate-180"
                  )}
                />
              </button>
              {open ? (
                <Link
                  href={coachUrl({ q: p.coachQuery })}
                  className="mt-1.5 inline-block text-[10px] text-zinc-600 hover:text-teal-400/80"
                >
                  Investigate with Coach →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
