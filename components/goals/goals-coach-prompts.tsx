"use client";

import Link from "next/link";
import type { GoalsCoachPrompt } from "@/lib/goals/goalsRaceBrief";
import { MessageCircle } from "lucide-react";

export function GoalsCoachPrompts({ prompts }: { prompts: GoalsCoachPrompt[] }) {
  if (prompts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        Ask Coach
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-subdued)] px-3 py-2 text-[13px] text-zinc-300 ring-1 ring-[var(--border-subtle)] transition-colors hover:bg-accent/[0.06] hover:text-accent hover:ring-accent/30"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
