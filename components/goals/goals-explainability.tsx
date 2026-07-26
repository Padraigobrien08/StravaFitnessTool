"use client";

import { useState } from "react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import type { GoalsExplainView } from "@/lib/goals/viewModels";
import { dash } from "@/components/home/primitives/tokens";
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
    <section className="flex flex-col">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className={dash.labelAccent}>Why the system believes this</span>
        <ConfidenceBadge level={confidence} />
      </div>
      <DashboardPanel padding="compact" elevated>
        <p className="text-sm leading-relaxed text-zinc-300">{data.summary}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className={dash.label}>Evidence chain</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-500">
              {data.basedOn.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent/60">✓</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={dash.label}>Limitations & uncertainty</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-600">
              {data.limitations.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span>○</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-left text-xs font-medium text-zinc-500 hover:bg-white/[0.04]"
          onClick={() => setAssumptionsOpen((v) => !v)}
          aria-expanded={assumptionsOpen}
        >
          Model assumptions
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", assumptionsOpen && "rotate-180")}
          />
        </button>
        {assumptionsOpen ? (
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            {data.assumptions.map((line, i) => (
              <li key={i}>· {line}</li>
            ))}
          </ul>
        ) : null}
      </DashboardPanel>
    </section>
  );
}
