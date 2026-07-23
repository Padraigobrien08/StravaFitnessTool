"use client";

import Link from "next/link";
import { useState } from "react";
import type { RecommendationOutcomesResult } from "@/lib/recommendation-outcomes/service";
import type { Adherence, OutcomeSignal } from "@/lib/recommendation-outcomes/types";
import { coachUrl } from "@/lib/coach/domainLinks";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const adherenceStyle: Record<Adherence, string> = {
  followed: "text-teal-400/90",
  partial: "text-amber-400/85",
  skipped: "text-rose-400/85",
  pending: "text-zinc-500",
  unknown: "text-zinc-600",
};

const signalStyle: Record<OutcomeSignal, string> = {
  supported: "text-teal-400/90",
  partially_supported: "text-teal-400/70",
  contradicted: "text-rose-400/85",
  inconclusive: "text-zinc-500",
};

const signalLabel: Record<OutcomeSignal, string> = {
  supported: "worked",
  partially_supported: "partly worked",
  contradicted: "backfired",
  inconclusive: "unclear",
};

export function IntelligenceRecommendationOutcomes({
  data,
}: {
  data: RecommendationOutcomesResult;
}) {
  const [expanded, setExpanded] = useState(false);
  if (data.recommendations.length === 0) return null;

  const { summary } = data;
  const visible = expanded ? data.recommendations : data.recommendations.slice(0, 4);
  const hiddenCount = data.recommendations.length - visible.length;

  return (
    <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-zinc-500">Recommendation outcomes</p>
        <Link
          href={coachUrl({ q: "Did I follow your recent advice?" })}
          className="text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          Ask Coach
        </Link>
      </div>

      <p className="mt-1 text-[11px] text-zinc-600">
        {summary.adherenceRatePct != null
          ? `${summary.adherenceRatePct}% adherence across ${summary.resolved} evaluated`
          : `${summary.total} recorded — evaluating as days pass`}
        {summary.signalEvaluated > 0
          ? ` · ${summary.supported} worked${summary.contradicted > 0 ? `, ${summary.contradicted} backfired` : ""}`
          : ""}
      </p>

      <ul className="mt-2 space-y-1.5">
        {visible.map((r) => (
          <li
            key={r.recommendationId}
            className="flex items-baseline gap-2 text-[12px] leading-snug"
          >
            <span className="w-[68px] shrink-0 tabular-nums text-zinc-600">{r.targetDate}</span>
            <span className="shrink-0 text-zinc-400">{r.kind}</span>
            <span className={cn("shrink-0 font-medium", adherenceStyle[r.adherence ?? "pending"])}>
              {r.adherence ?? "pending"}
            </span>
            {r.outcomeSignal ? (
              <span className={cn("shrink-0 text-[11px]", signalStyle[r.outcomeSignal])}>
                · {signalLabel[r.outcomeSignal]}
              </span>
            ) : null}
            {r.evaluationNote ? (
              <span className="truncate text-[11px] text-zinc-600">{r.evaluationNote}</span>
            ) : null}
          </li>
        ))}
      </ul>

      {hiddenCount > 0 ? (
        <button
          type="button"
          className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown className={cn("h-3 w-3", expanded && "rotate-180")} />
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </section>
  );
}
