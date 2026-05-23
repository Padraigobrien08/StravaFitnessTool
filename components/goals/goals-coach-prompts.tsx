"use client";

import Link from "next/link";
import type { GoalsCoachPrompt } from "@/lib/goals/goalsRaceBrief";
import { MessageCircle } from "lucide-react";

export function GoalsCoachPrompts({ prompts }: { prompts: GoalsCoachPrompt[] }) {
  if (prompts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-zinc-600">Ask Coach</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-300 transition-colors hover:border-teal-500/25 hover:bg-teal-500/[0.06] hover:text-teal-100/90"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
