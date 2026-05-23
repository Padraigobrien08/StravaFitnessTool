"use client";

import Link from "next/link";
import type { HomeTodayView } from "@/lib/home/operatingSystemView";
import { coachUrl } from "@/lib/coach/domainLinks";
import { OsSection } from "./os-section";

export function OsToday({ today }: { today: HomeTodayView }) {
  return (
    <OsSection
      id="today"
      title="Today's priority"
      action={
        <Link
          href={coachUrl({ q: "What should I prioritize in today's session?" })}
          className="text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          Coach →
        </Link>
      }
    >
      <div className="rounded-lg border border-teal-500/15 bg-teal-500/[0.04] px-3.5 py-3 ring-1 ring-teal-500/10">
        <p className="text-[10px] font-medium uppercase tracking-wide text-teal-500/70">
          Today
        </p>
        <p className="mt-1 font-display text-base font-semibold text-zinc-100">
          {today.title}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">{today.why}</p>
        <p className="mt-2 text-[11px] text-zinc-600">
          <span className="text-zinc-500">Supporting state: </span>
          {today.stateLine}
          {today.fromPlan ? " · from saved plan" : ""}
        </p>
      </div>
    </OsSection>
  );
}
