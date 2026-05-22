"use client";

import type { CoachingDomain } from "@/lib/coach/types";
import { cn } from "@/lib/utils";

export function CoachDomainChips({
  domains,
  activeDomainId,
  onSelect,
  disabled,
}: {
  domains: CoachingDomain[];
  activeDomainId: string | null;
  onSelect: (domain: CoachingDomain) => void;
  disabled?: boolean;
}) {
  return (
    <div className="coach-domain-chips -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-thin">
      {domains.slice(0, 8).map((d) => (
        <button
          key={d.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(d)}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            "disabled:opacity-40",
            activeDomainId === d.id
              ? "border-teal-500/35 bg-teal-500/15 text-teal-100"
              : "border-white/[0.08] bg-white/[0.02] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-300"
          )}
        >
          {d.title}
        </button>
      ))}
    </div>
  );
}
