"use client";

import { useState } from "react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Eyebrow, Panel } from "@/components/console/console-kit";
import type { GoalsExplainView } from "@/lib/goals/viewModels";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function GoalsExplainability({
  data,
  confidence,
}: {
  data: GoalsExplainView;
  confidence: "low" | "medium" | "high";
}) {
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Eyebrow>Why the system believes this</Eyebrow>
        <ConfidenceBadge level={confidence} />
      </div>

      <p className="text-sm leading-relaxed text-zinc-300">{data.summary}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Evidence chain
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-500">
            {data.basedOn.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent/70">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Limitations & uncertainty
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-500">
            {data.limitations.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-zinc-600">○</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        type="button"
        className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg bg-[var(--surface-subdued)] px-3 py-2 text-left text-xs font-medium text-zinc-500 ring-1 ring-[var(--border-subtle)] hover:text-zinc-300"
        onClick={() => setAssumptionsOpen((v) => !v)}
        aria-expanded={assumptionsOpen}
      >
        Model assumptions
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", assumptionsOpen && "rotate-180")}
        />
      </button>
      {assumptionsOpen ? (
        <ul className="mt-2 space-y-1 text-xs text-zinc-500">
          {data.assumptions.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
