"use client";

import Link from "next/link";
import type { NotableSessionView } from "@/lib/runs/viewModels";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const sigStyles = {
  critical: "border-teal-500/25 bg-teal-500/[0.06] text-teal-300/90",
  meaningful: "border-amber-500/20 bg-amber-500/[0.04] text-amber-200/80",
  supporting: "border-white/[0.06] bg-white/[0.02] text-zinc-500",
};

export function NotableSessionsFeed({
  sessions,
  compact,
}: {
  sessions: NotableSessionView[];
  compact?: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-[12px] text-zinc-600">No ranked sessions yet.</p>
    );
  }

  return (
    <ol className={cn("space-y-2", compact && "space-y-1.5")}>
      {sessions.map((s, i) => (
        <li key={s.id}>
          <Link
            href={s.href}
            className={cn(
              "group flex gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-white/[0.03]",
              sigStyles[s.significance]
            )}
          >
            <span className="mt-0.5 w-5 shrink-0 text-[11px] font-medium tabular-nums text-zinc-600">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-medium uppercase tracking-wider opacity-80">
                  {s.significance}
                </span>
                <span className="text-[10px] text-zinc-600">{s.meta}</span>
              </div>
              <h3 className="mt-0.5 text-[13px] font-medium text-zinc-100 group-hover:text-white">
                {s.title}
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">{s.why}</p>
              {!compact ? (
                <>
                  <p className="mt-1 text-[11px] text-teal-400/70">
                    {s.adaptation}
                  </p>
                  <p className="text-[10px] text-zinc-600">{s.goalRelation}</p>
                </>
              ) : null}
            </div>
            <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-80" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
