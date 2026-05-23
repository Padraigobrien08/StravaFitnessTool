"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { topicCoachLink } from "@/lib/coach/domainLinks";
import { OsSection } from "./os-section";

const HOME_INVESTIGATIONS = [
  {
    label: "Why is readiness improving?",
    query: "Why did my readiness change this week?",
  },
  {
    label: "Am I tapering correctly?",
    query: "How should I execute race week given my current state?",
  },
  {
    label: "Compare to strongest HM build",
    query: "Compare this training block to my strongest historical block.",
  },
  {
    label: "Is strength work interfering?",
    query: "Is my gym work helping or hurting my running?",
  },
  {
    label: "What improves my pace historically?",
    query: "What training patterns historically improve my pace?",
  },
  {
    label: "Explain this week's plan",
    query: "Walk me through my saved week plan and what to adjust.",
  },
] as const;

export function OsInvestigations() {
  return (
    <OsSection title="Explore with Coach">
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {HOME_INVESTIGATIONS.map((item) => (
          <Link
            key={item.label}
            href={topicCoachLink("investigation", item.query)}
            className="group rounded-md border border-[var(--border-subtle)] bg-[var(--surface)]/30 px-2.5 py-2 transition-colors hover:bg-[var(--surface-hover)]"
          >
            <p className="text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100">
              {item.label}
            </p>
            <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] text-zinc-600 group-hover:text-zinc-400">
              Open in Coach <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </Link>
        ))}
      </div>
    </OsSection>
  );
}
