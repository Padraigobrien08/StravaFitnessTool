"use client";

import { COACH_PROMPT_GROUPS } from "@/lib/coach/promptGroups";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { Activity, Calendar, Search } from "lucide-react";

const GROUP_ICONS = {
  understand: Search,
  plan: Calendar,
  patterns: Activity,
} as const;

export function CoachEmptyState({
  onPrompt,
  memory,
  athleteName,
  disabled,
}: {
  onPrompt: (text: string) => void;
  memory: MemorySnippet[];
  athleteName?: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="coach-empty-enter flex flex-col gap-6 py-2">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
          {athleteName ? `${athleteName}, ` : ""}your endurance reasoning workspace
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
          Not a chatbot — a grounded analyst that compares sessions, explains readiness, and
          remembers how your body responds over time.
        </p>
      </div>

      {memory.length > 0 ? (
        <div className="rounded-xl border border-teal-500/10 bg-teal-500/[0.04] p-4">
          <p className={cn(dash.labelAccent, "mb-3")}>Athletic memory</p>
          <ul className="space-y-2.5">
            {memory.map((m) => (
              <li key={m.id} className="text-sm text-zinc-400">
                <span className="font-medium text-zinc-300">{m.label}: </span>
                {m.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {COACH_PROMPT_GROUPS.map((group) => {
          const Icon = GROUP_ICONS[group.id as keyof typeof GROUP_ICONS] ?? Search;
          return (
            <div
              key={group.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-teal-500/70" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">{group.title}</h3>
                  <p className="text-[11px] text-zinc-600">{group.description}</p>
                </div>
              </div>
              <ul className="space-y-2">
                {group.prompts.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onPrompt(prompt)}
                      className="w-full rounded-lg border border-transparent px-2 py-2 text-left text-xs text-zinc-400 transition-colors hover:border-white/[0.08] hover:bg-white/[0.03] hover:text-zinc-200 disabled:opacity-40"
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
