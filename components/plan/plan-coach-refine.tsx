"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { topicCoachLink } from "@/lib/coach/domainLinks";
import { Eyebrow } from "@/components/console/console-kit";

const PROMPTS = [
  { label: "Make more conservative", q: "Make my saved week plan more conservative" },
  { label: "Reduce intensity", q: "Reduce intensity in my week plan while keeping volume" },
  { label: "Add cross-training", q: "Add appropriate cross-training to my week plan" },
  { label: "Shift workout days", q: "Help me shift workouts to Mon/Wed/Fri/Sun only" },
  { label: "Optimize my schedule", q: "Optimize this week around my schedule constraints" },
  {
    label: "Preserve freshness",
    q: "Preserve freshness more aggressively in this week plan",
  },
] as const;

export function PlanCoachRefine() {
  return (
    <div>
      <Eyebrow className="mb-1.5">Refine with Coach</Eyebrow>
      <div className="flex flex-wrap gap-1">
        {PROMPTS.map((p) => (
          <Link
            key={p.label}
            href={topicCoachLink("plan-refine", p.q)}
            className="group inline-flex items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)]/50 px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {p.label}
            <ArrowRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
