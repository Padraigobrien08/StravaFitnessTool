"use client";

import { useState } from "react";
import Link from "next/link";
import type { InsightRowViewModel } from "@/lib/home/dashboardData";
import { ConfidenceDots } from "./primitives/confidence-dots";
import { EvidencePill } from "./primitives/evidence-pill";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";

const kindLabel = {
  risk: "Risk",
  opportunity: "Opportunity",
} as const;

export function IntelligenceFeedCard({ item }: { item: InsightRowViewModel }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const pillTone =
    item.severity === "risk"
      ? "risk"
      : item.severity === "caution"
        ? "caution"
        : "positive";

  const borderTone =
    item.kind === "risk"
      ? "border-l-red-500/45"
      : "border-l-teal-500/45";

  const TrendIcon =
    item.trend?.positive === true
      ? TrendingUp
      : item.trend?.positive === false
        ? TrendingDown
        : Minus;

  return (
    <article
      className={cn(
        "rounded-xl border border-white/[0.05] border-l-[3px] bg-white/[0.02] px-4 py-3.5 transition-colors duration-200 sm:px-5",
        borderTone,
        "hover:bg-white/[0.035] hover:border-white/[0.08]"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.14em]",
                item.kind === "risk" ? "text-red-400/85" : "text-teal-400/85"
              )}
            >
              {kindLabel[item.kind]}
            </span>
            {item.trend ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-medium",
                  item.trend.positive === true && "text-teal-400/90",
                  item.trend.positive === false && "text-amber-400/90",
                  item.trend.positive === null && "text-zinc-500"
                )}
              >
                <TrendIcon className="h-3 w-3" aria-hidden />
                {item.trend.text}
              </span>
            ) : null}
            <ConfidenceDots level={item.confidence} />
          </div>

          <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-zinc-50 sm:text-lg">
            {item.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            {item.summary}
          </p>

          {item.pills.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {item.pills.map((p) => (
                <EvidencePill key={p} tone={pillTone}>
                  {p}
                </EvidencePill>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="mt-2 text-xs font-medium text-zinc-500 transition-colors hover:text-teal-400/90"
            onClick={() => setWhyOpen((v) => !v)}
            aria-expanded={whyOpen}
          >
            {whyOpen ? "Hide context" : "Why it matters →"}
          </button>
          {whyOpen ? (
            <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-zinc-500">
              {item.whyItMatters}
            </p>
          ) : null}
          {item.evidence && item.evidence.length > 0 && whyOpen ? (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-600">
              {item.evidence.map((line, i) => (
                <li key={i}>· {line}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 lg:min-w-[11rem] lg:items-end">
          {item.recommendation ? (
            <p className="text-xs leading-snug text-zinc-500 lg:text-right">
              <span className="font-medium text-zinc-400">Rec · </span>
              {item.recommendation}
            </p>
          ) : null}
          {item.recommendationHref ? (
            <Link
              href={item.recommendationHref}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-300/95 ring-1 ring-inset ring-teal-500/20 transition-colors hover:bg-teal-500/15 hover:text-teal-200"
            >
              Take action
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
