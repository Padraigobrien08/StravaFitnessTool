"use client";

import type { ParsedCoachResponse } from "@/lib/coach/parseResponse";
import {
  confidenceLevel,
  describeGrounding,
  primaryLimitation,
  type CoachConfidence,
} from "@/lib/coach/groundingMeta";
import { formatCoachText } from "@/lib/coach/formatText";
import { cn } from "@/lib/utils";

function confidenceClass(level: CoachConfidence): string {
  if (level === "high") return "text-zinc-300";
  // medium-high sits with medium rather than with high: the word carries the
  // distinction, and brightening it would restore the overstatement by other means.
  if (level === "medium-high" || level === "medium") return "text-zinc-400";
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
  const grounding = describeGrounding(toolsUsed);
  const limitation = primaryLimitation(parsed);

  if (!level && grounding.kind === "unknown" && !limitation) return null;

  return (
    <div className="coach-response-meta mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/[0.04] pt-4 text-[11px] leading-snug text-zinc-500">
      {level ? (
        <span>
          <span className="text-zinc-600">Confidence </span>
          <span className={cn("font-medium", confidenceClass(level))}>{level}</span>
        </span>
      ) : null}
      {grounding.kind === "tools" ? (
        <span>
          <span className="text-zinc-600">Grounded in </span>
          <span className="text-zinc-400">{grounding.labels.join(", ")}</span>
        </span>
      ) : null}
      {/* Said plainly rather than omitted. An answer with no chip looks the same as one
          whose chip did not fit, and this is the case a reader most needs to see. */}
      {grounding.kind === "none" ? (
        <span>
          <span className="text-zinc-600">Grounded in </span>
          <span className="text-zinc-500">no tools called — answered from context alone</span>
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
