"use client";

import type { ParsedCoachResponse } from "@/lib/coach/parseResponse";
import { confidenceLevel, inferGroundedIn, primaryLimitation } from "@/lib/coach/groundingMeta";
import { formatCoachText } from "@/lib/coach/formatText";
import { cn } from "@/lib/utils";

function confidenceClass(level: "low" | "medium" | "high"): string {
  if (level === "high") return "text-zinc-300";
  if (level === "medium") return "text-zinc-400";
  return "text-zinc-500";
}

export function CoachResponseMeta({
  parsed,
  toolsUsed,
}: {
  parsed: ParsedCoachResponse;
  toolsUsed?: string[];
}) {
  const level = confidenceLevel(parsed.confidence);
  const grounded = inferGroundedIn(parsed, toolsUsed);
  const limitation = primaryLimitation(parsed);

  if (!level && grounded.length === 0 && !limitation) return null;

  return (
    <div className="coach-response-meta mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/[0.04] pt-4 text-[11px] leading-snug text-zinc-500">
      {level ? (
        <span>
          <span className="text-zinc-600">Confidence </span>
          <span className={cn("font-medium", confidenceClass(level))}>{level}</span>
        </span>
      ) : null}
      {grounded.length > 0 ? (
        <span>
          <span className="text-zinc-600">Grounded in </span>
          <span className="text-zinc-400">{grounded.join(", ")}</span>
        </span>
      ) : null}
      {limitation ? (
        <span className="max-w-full">
          <span className="text-zinc-600">Limitation </span>
          <span className="text-zinc-500">{formatCoachText(limitation)}</span>
        </span>
      ) : null}
    </div>
  );
}
