"use client";

import type { CoachWorkspaceState } from "@/lib/coach/types";
import { cn } from "@/lib/utils";

const FALLBACK_PROMPTS = [
  "Why did readiness change this week?",
  "Compare my last 3 threshold runs.",
  "Is cross-training helping or interfering?",
  "What should I prioritize before race day?",
];

export function CoachThreadStarter({
  state,
  onSelect,
  disabled,
}: {
  state: CoachWorkspaceState;
  onSelect: (query: string) => void;
  disabled?: boolean;
}) {
  const signal = state.observations[0]?.text;
  const prompts = [
    ...state.investigations.slice(0, 3).map((i) => i.question),
    ...FALLBACK_PROMPTS,
  ].slice(0, 4);

  const unique = [...new Set(prompts)];

  return (
    <div className="coach-thread-starter space-y-8 pb-4">
      <div className="space-y-2">
        <p className="text-[15px] leading-relaxed text-zinc-300">
          {state.currentFocus}
        </p>
        {state.focusRationale ? (
          <p className="text-[13px] leading-relaxed text-zinc-500">
            {state.focusRationale}
          </p>
        ) : null}
      </div>

      {signal ? (
        <div className="rounded-lg bg-white/[0.025] px-3.5 py-3">
          <p className="text-[11px] text-zinc-600">Recent signal</p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
            {signal}
          </p>
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-[13px] text-zinc-500">Start an investigation</p>
        <ul className="space-y-1">
          {unique.map((q) => (
            <li key={q}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(q)}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left text-[14px] leading-snug text-zinc-300 transition-colors",
                  "hover:bg-white/[0.04] disabled:opacity-40"
                )}
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
