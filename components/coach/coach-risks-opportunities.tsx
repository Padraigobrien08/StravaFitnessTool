"use client";

import type { RiskOpportunity } from "@/lib/coach/types";
import { cn } from "@/lib/utils";
import { ShieldAlert, Sparkles } from "lucide-react";

export function CoachRisksOpportunities({ items }: { items: RiskOpportunity[] }) {
  if (items.length === 0) return null;

  const risks = items.filter((i) => i.kind === "risk");
  const opps = items.filter((i) => i.kind === "opportunity");

  return (
    <section className="coach-risks-ops space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Active risks & opportunities
        </p>
        <p className="mt-0.5 text-xs text-zinc-600">
          Evolving signals the reasoning engine is tracking
        </p>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row">
        {risks.length > 0 ? (
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-500/70">
              <ShieldAlert className="h-3 w-3" />
              Risks
            </p>
            <ul className="space-y-1.5">
              {risks.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2 text-xs leading-snug text-amber-100/80"
                >
                  <span className="text-[10px] text-amber-500/50">{r.domain}</span>
                  <p className="mt-0.5">{r.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {opps.length > 0 ? (
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-teal-500/70">
              <Sparkles className="h-3 w-3" />
              Opportunities
            </p>
            <ul className="space-y-1.5">
              {opps.map((o) => (
                <li
                  key={o.id}
                  className={cn(
                    "rounded-lg border border-teal-500/15 bg-teal-500/[0.05] px-3 py-2 text-xs leading-snug text-teal-100/85",
                  )}
                >
                  <span className="text-[10px] text-teal-500/50">{o.domain}</span>
                  <p className="mt-0.5">{o.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
