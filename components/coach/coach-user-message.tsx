"use client";

import { cn } from "@/lib/utils";

/** Investigation prompt — not a chat bubble */
export function CoachUserMessage({
  content,
  index = 0,
}: {
  content: string;
  index?: number;
}) {
  return (
    <div
      className={cn("coach-investigation-prompt coach-msg-enter border-l-2 border-teal-500/35 pl-3")}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
        Investigation
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-200">{content}</p>
    </div>
  );
}
