"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/**
 * Wraps a piece of jargon with a point-of-use definition. Renders the term with
 * a subtle dotted underline; hover or keyboard-focus reveals a plain-language
 * tooltip. Pass `children` to show a custom label (e.g. the term with its
 * value); omit to use the glossary's canonical short label.
 */
export function JargonTerm({
  term,
  children,
  className,
}: {
  term: GlossaryKey;
  children?: ReactNode;
  className?: string;
}) {
  const entry = GLOSSARY[term];

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              aria-label={`${entry.label}: ${entry.definition}`}
              className={cn(
                "cursor-help rounded-sm underline decoration-dotted decoration-current/40 underline-offset-2 outline-none focus-visible:ring-1 focus-visible:ring-ring",
                className,
              )}
            />
          }
        >
          {children ?? entry.label}
        </TooltipTrigger>
        <TooltipContent className="flex-col items-start gap-0.5">
          <span className="font-medium">{entry.label}</span>
          <span className="block max-w-[220px] leading-snug text-background/75">
            {entry.definition}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
