"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUp, Sparkles } from "lucide-react";

export function CoachComposer({
  value,
  onChange,
  onSubmit,
  loading,
  disabled,
  placeholder,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "coach-composer shrink-0 border-t border-white/[0.06] bg-[#09090b]/95 backdrop-blur-md",
        compact ? "px-3 py-2.5" : "px-4 py-3 sm:px-5"
      )}
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border border-white/[0.08] bg-[#0c0d10] p-2 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.03]",
          !compact && "mx-auto max-w-3xl"
        )}
      >
        <div className="hidden shrink-0 pl-1 sm:block">
          <Sparkles className="h-4 w-4 text-teal-500/50" />
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || disabled}
          rows={1}
          placeholder={placeholder ?? "Ask why, compare sessions, or plan ahead…"}
          className={cn(
            "max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-zinc-200",
            "placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={loading || disabled || !value.trim()}
          onClick={onSubmit}
          className="h-9 w-9 shrink-0 rounded-lg p-0"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      {!compact ? (
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-zinc-600">
          Grounded in your Strava data · analytical reasoning · not medical advice
        </p>
      ) : null}
    </div>
  );
}
