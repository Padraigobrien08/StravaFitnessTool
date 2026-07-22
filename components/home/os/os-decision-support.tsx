"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RiskOpportunity } from "@/lib/coach/types";
import { topicCoachLink } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import { OsSection } from "./os-section";

export function OsDecisionSupport({
  risks,
  opportunities,
  primaryActionBullets,
}: {
  risks: RiskOpportunity[];
  opportunities: RiskOpportunity[];
  primaryActionBullets: string[];
}) {
  return (
    <OsSection title="Decision support">
      <div className="grid gap-2 lg:grid-cols-3">
        <DecisionCol
          title="Risks"
          items={risks.map((r) => r.text)}
          tone="risk"
          query="What risks should I address in my current training?"
        />
        <DecisionCol
          title="Opportunities"
          items={opportunities.map((o) => o.text)}
          tone="opp"
          query="Which opportunities should I act on this week?"
        />
        <div className="rounded-lg bg-[var(--surface)] p-3 ring-1 ring-[var(--border-subtle)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Primary action
          </p>
          <ul className="mt-2 space-y-1.5">
            {primaryActionBullets.map((line) => (
              <li key={line} className="flex gap-1.5 text-[12px] leading-snug text-zinc-200">
                <span className="text-zinc-600">–</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Link
            href={topicCoachLink("recommendation", primaryActionBullets[0] ?? "")}
            className="mt-2 inline-flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            Discuss in Coach <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </OsSection>
  );
}

function DecisionCol({
  title,
  items,
  tone,
  query,
}: {
  title: string;
  items: string[];
  tone: "risk" | "opp";
  query: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3",
        tone === "risk" ? "bg-amber-500/[0.04]" : "bg-teal-500/[0.04]",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          tone === "risk" ? "text-amber-400/60" : "text-teal-500/70",
        )}
      >
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.length === 0 ? (
          <li className="text-[11px] text-zinc-600">None flagged</li>
        ) : (
          items.slice(0, 4).map((t) => (
            <li
              key={t}
              className={cn(
                "text-[11px] leading-snug",
                tone === "risk" ? "text-amber-100/75" : "text-teal-100/80",
              )}
            >
              {t}
            </li>
          ))
        )}
      </ul>
      <Link
        href={topicCoachLink(tone === "risk" ? "intensity-stacking" : "opportunities", query)}
        className="mt-2 inline-flex items-center gap-0.5 text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        Coach <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
