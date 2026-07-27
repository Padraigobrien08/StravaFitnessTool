"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import type { AnomalyReport } from "@/lib/analytics/anomalies";
import type { ChangePointReport } from "@/lib/analytics/changePoints";
import type { CorrelationReport } from "@/lib/analytics/correlations";
import type { UncertaintyEstimates } from "@/lib/analytics/uncertaintyEstimates";
import { signalCoachLink } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import { IntelligenceStandoutSessions } from "./intelligence-standout-sessions";
import { IntelligenceAnomalies } from "./intelligence-anomalies";
import { IntelligenceUncertainty } from "./intelligence-uncertainty";
import { IntelligenceCorrelations } from "./intelligence-correlations";
import { IntelligenceChangePoints } from "./intelligence-change-points";
import type { PersonalZScores } from "@/lib/analytics/personalZScores";

type DeepDiveData = {
  personalZScores: PersonalZScores;
  anomalies: AnomalyReport;
  uncertaintyEstimates: UncertaintyEstimates;
  correlations: CorrelationReport;
  changePoints: ChangePointReport;
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function IntelligenceDeepDive({ data }: { data: DeepDiveData }) {
  const [open, setOpen] = useState(false);

  const anomalyCount = data.anomalies.available ? data.anomalies.anomalies.length : 0;
  const changePointCount = data.changePoints.available ? data.changePoints.changePoints.length : 0;
  const strongCorr = data.correlations.available
    ? data.correlations.correlations.filter(
        (c) => c.strength === "strong" || c.strength === "moderate",
      ).length
    : 0;
  const intervalCount = data.uncertaintyEstimates.available
    ? data.uncertaintyEstimates.estimates.length
    : 0;
  const hasStandouts =
    data.personalZScores.available &&
    Boolean(data.personalZScores.standouts.best || data.personalZScores.standouts.worst);

  const chips: string[] = [];
  if (hasStandouts) chips.push("standout sessions");
  if (anomalyCount) chips.push(plural(anomalyCount, "anomaly", "anomalies"));
  if (changePointCount) chips.push(plural(changePointCount, "fitness change-point"));
  if (strongCorr) chips.push(plural(strongCorr, "notable correlation"));
  if (intervalCount) chips.push(`form intervals on ${plural(intervalCount, "metric")}`);

  // Nothing to show — stay out of the way entirely.
  if (chips.length === 0) return null;

  return (
    <section className="rounded-xl bg-[var(--surface-elevated)] shadow-[var(--surface-shadow)] ring-1 ring-[var(--border-subtle)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <span className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Deep dive · signals & statistics
          </span>
          <span className="mt-1 block truncate font-mono text-[11px] text-zinc-500">
            {chips.join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-zinc-500">
          {open ? "Hide" : "Show analysis"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-[var(--border-subtle)] px-4 pb-4 pt-3 sm:px-5">
          <IntelligenceStandoutSessions data={data.personalZScores} />
          <IntelligenceAnomalies data={data.anomalies} />
          <IntelligenceUncertainty data={data.uncertaintyEstimates} />
          <IntelligenceCorrelations data={data.correlations} />
          <IntelligenceChangePoints data={data.changePoints} />
        </div>
      ) : (
        <div className="border-t border-[var(--border-subtle)] px-4 py-2.5 sm:px-5">
          <Link
            href={signalCoachLink(
              "Walk me through the statistical signals in my data — anomalies, correlations, and fitness change-points.",
            )}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:text-accent/80"
          >
            Ask Coach <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </section>
  );
}
