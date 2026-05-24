"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  PLAN_CONTEXT_COMPACT_ROWS,
  PLAN_CONTEXT_EXPANDED_ROWS,
  PLAN_CONTEXT_MAX_CHARS,
  PLAN_CONTEXT_SUGGESTIONS,
} from "@/lib/plan/planContextConstants";
import {
  loadPlanContextDraft,
  savePlanContextDraft,
} from "@/lib/plan/planContextStorage";
import { cn } from "@/lib/utils";

export function PlanPlanningContext({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = loadPlanContextDraft();
    if (draft) onChange(draft);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate draft once
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePlanContextDraft(value);
  }, [value, hydrated]);

  const appendSuggestion = useCallback(
    (text: string) => {
      const next = value.trim() ? `${value.trim()}\n${text}` : text;
      onChange(next.slice(0, PLAN_CONTEXT_MAX_CHARS));
      setExpanded(true);
    },
    [value, onChange]
  );

  const chars = value.length;
  const nearLimit = chars > PLAN_CONTEXT_MAX_CHARS * 0.85;

  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subdued)]/50 p-3",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-zinc-300">
            Planning context
            <span className="ml-1.5 font-normal text-zinc-600">(optional)</span>
          </p>
          <p className="mt-0.5 max-w-xl text-[11px] text-zinc-600">
            Tell the planner what this week is about — post-race recovery, travel,
            no goal, returning from break, etc.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto gap-0.5 px-1 py-0 text-[10px] text-zinc-500 hover:text-zinc-300"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Shorter field
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Longer field
            </>
          )}
        </Button>
      </div>

      <Textarea
        className="mt-2 resize-y border-[var(--border-subtle)] bg-[var(--surface)]/80 text-[12px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus-visible:border-teal-500/40 focus-visible:ring-teal-500/25"
        rows={expanded ? PLAN_CONTEXT_EXPANDED_ROWS : PLAN_CONTEXT_COMPACT_ROWS}
        placeholder="e.g. I just ran a half marathon — plan my recovery for this week. No race goal for now."
        value={value}
        disabled={disabled}
        maxLength={PLAN_CONTEXT_MAX_CHARS}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "text-[10px]",
            nearLimit ? "text-amber-400/80" : "text-zinc-600"
          )}
        >
          {chars.toLocaleString()} / {PLAN_CONTEXT_MAX_CHARS.toLocaleString()}{" "}
          characters
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {PLAN_CONTEXT_SUGGESTIONS.map((s) => (
          <Button
            key={s}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-auto rounded-md border-[var(--border-subtle)] bg-[var(--surface)]/60 px-2 py-0.5 text-left text-[10px] font-normal text-zinc-500 hover:border-teal-500/25 hover:text-zinc-300"
            onClick={() => appendSuggestion(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </section>
  );
}
