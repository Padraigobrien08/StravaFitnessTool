"use client";

import { useState } from "react";
import type { RiskPattern, RiskSeverity } from "@/lib/analytics/riskPatterns";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const severityStyle: Record<RiskSeverity, string> = {
  high: "border-rose-500/25 bg-rose-500/[0.04]",
  medium: "border-amber-500/20 bg-amber-500/[0.03]",
  low: "border-white/[0.06] bg-white/[0.02]",
};

const severityDot: Record<RiskSeverity, string> = {
  high: "bg-rose-400/80",
  medium: "bg-amber-400/80",
  low: "bg-zinc-500/70",
};

export function IntelligenceRiskPatterns({ patterns }: { patterns: RiskPattern[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (patterns.length === 0) return null;

  return (
    <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] font-medium text-zinc-500">
        Risk patterns
        <span className="ml-1.5 text-zinc-600">{patterns.length} flagged · ranked by severity</span>
      </p>

      <ul className="mt-2 space-y-2">
        {patterns.map((p) => {
          const open = expandedId === p.id;
          return (
            <li
              key={p.id}
              className={cn("rounded-lg border px-3 py-2.5", severityStyle[p.severity])}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setExpandedId(open ? null : p.id)}
              >
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", severityDot[p.severity])}
                />
                <span className="text-[13px] font-medium text-zinc-200">{p.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                  {p.severity} · {p.confidence}
                </span>
                <ChevronDown
                  className={cn("ml-auto h-3.5 w-3.5 text-zinc-600", open && "rotate-180")}
                />
              </button>

              {open ? (
                <div className="mt-2 space-y-2 pl-3.5">
                  <ul className="space-y-1">
                    {p.evidence.map((e, i) => (
                      <li key={i} className="text-[12px] leading-snug text-zinc-400">
                        {e}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] leading-snug text-teal-300/85">
                    <span className="text-zinc-500">Mitigation: </span>
                    {p.mitigation}
                  </p>
                </div>
              ) : (
                <p className="mt-1 pl-3.5 text-[12px] leading-snug text-zinc-500">
                  {p.evidence[0]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
