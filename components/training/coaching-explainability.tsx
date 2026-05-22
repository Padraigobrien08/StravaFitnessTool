"use client";

import { useState } from "react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import type { CoachingExplainView } from "@/lib/training/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function CoachingExplainability({
  data,
  className,
}: {
  data: CoachingExplainView;
  className?: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className={cn("flex flex-col", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className={dash.labelAccent}>Why the system thinks this</span>
        <ConfidenceBadge level={data.confidence} />
      </div>
      <DashboardPanel padding="compact" elevated className="flex-1">
        <p className="text-sm leading-relaxed text-zinc-300">
          <span className="font-medium text-zinc-200">Recommendation · </span>
          {data.recommendationWhy}
        </p>

        <p className="mt-4 text-xs text-zinc-500">
          Confidence:{" "}
          <span className="font-medium text-zinc-300">
            {data.confidenceLabel}
          </span>
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className={dash.label}>Based on</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-500">
              {data.basedOn.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-teal-500/60">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={dash.label}>Missing / limits</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-600">
              {data.missing.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-zinc-600">○</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-left text-xs font-medium text-zinc-500 transition-colors hover:bg-white/[0.04]"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Limitations & assumptions
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {open ? (
          <ul className="mt-2 space-y-1 border-l-2 border-white/[0.06] pl-3 text-xs leading-relaxed text-zinc-600">
            {data.limitations.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}
      </DashboardPanel>
    </section>
  );
}
