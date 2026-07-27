"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowUp, Loader2 } from "lucide-react";

const TEXTAREA_MAX_PX = 128;

export function CoachComposer({
  value,
  onChange,
  onSubmit,
  loading,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, TEXTAREA_MAX_PX);
    ta.style.height = `${Math.max(next, 44)}px`;
  }, [value]);

  const canSend = !loading && !disabled && value.trim().length > 0;

  return (
    <div className="coach-composer shrink-0 border-t border-[var(--border-subtle)] bg-[var(--header-bg)] px-3 pb-3 pt-3 sm:px-5">
      <div className="coach-message-column mx-auto w-full">
        {loading ? (
          <Progress
            className="coach-composer-progress mb-2 h-px w-full gap-0"
            value={null}
            aria-hidden
          >
            <ProgressTrack className="h-px overflow-hidden rounded-full bg-white/[0.04]">
              <ProgressIndicator className="coach-composer-progress-bar w-1/3 bg-zinc-600/60" />
            </ProgressTrack>
          </Progress>
        ) : null}

        <div
          className={cn(
            "flex items-end gap-2 rounded-xl bg-[var(--input-bg)] px-3 py-2",
            "ring-1 ring-[var(--border-default)]",
            "transition-[box-shadow,ring-color]",
            "focus-within:ring-[var(--ring)]",
            (disabled || loading) && "opacity-60",
          )}
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading || disabled}
            rows={1}
            placeholder={placeholder ?? "Ask a follow-up or compare another block…"}
            className={cn(
              "min-h-[44px] max-h-32 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0.5 py-2.5 text-[15px] leading-snug text-zinc-100 shadow-none",
              "placeholder:text-zinc-600 focus-visible:border-0 focus-visible:ring-0 disabled:cursor-not-allowed dark:bg-transparent",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSubmit();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={!canSend}
            onClick={onSubmit}
            aria-label="Send message"
            className="mb-0.5 h-9 w-9 shrink-0 rounded-lg bg-zinc-200 p-0 text-zinc-900 hover:bg-white disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
