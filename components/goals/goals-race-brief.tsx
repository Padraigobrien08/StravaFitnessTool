"use client";

import type { GoalsRaceBriefView } from "@/lib/goals/goalsRaceBrief";
import { GoalsCoachPrompts } from "@/components/goals/goals-coach-prompts";
import { cn } from "@/lib/utils";

export function GoalsRaceBrief({ brief }: { brief: GoalsRaceBriefView }) {
  return (
    <section className="goals-race-brief relative overflow-hidden rounded-xl bg-gradient-to-br from-[#12141a] via-[#0d0e12] to-[#0a0b0e] px-5 py-5 sm:px-6 sm:py-6">
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(160px,200px)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-[12px] text-zinc-500">Race forecast</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {brief.headline}
            </h2>
            {brief.targetTimeDisplay ? (
              <p className="mt-1 text-sm text-zinc-500">
                Goal ·{" "}
                <span className="font-medium tabular-nums text-zinc-300">
                  {brief.targetTimeDisplay}
                </span>
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-[11px] font-medium text-zinc-600">Current belief</p>
            <p className="mt-1.5 max-w-2xl text-[15px] leading-[1.62] text-zinc-300">
              {brief.belief}
            </p>
          </div>

          <div className="rounded-lg bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/[0.05]">
            <p className="text-[11px] font-medium text-zinc-500">Primary action</p>
            <p className="mt-1.5 text-[14px] leading-[1.55] text-zinc-100">{brief.primaryAction}</p>
          </div>

          {brief.evidenceBullets.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium text-zinc-600">Evidence</p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-[1.5] text-zinc-500">
                {brief.evidenceBullets.map((item, i) => (
                  <li key={i} className="flex gap-2 pl-0.5">
                    <span className="mt-[0.55rem] h-px w-2 shrink-0 bg-zinc-600/80" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[13px] leading-relaxed text-zinc-500">
            <span className="font-medium text-zinc-400">Confidence · </span>
            {brief.confidenceLine}
          </p>

          {brief.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-amber-500/15 bg-amber-500/[0.05] px-3 py-2.5 text-[12px] text-amber-200/80">
              {brief.warnings.map((w, i) => (
                <li key={`${i}-${w}`}>· {w}</li>
              ))}
            </ul>
          ) : null}

          <GoalsCoachPrompts prompts={brief.coachPrompts} />
        </div>

        <aside className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <BriefMetric label="Most likely" value={brief.mostLikely} sub={brief.distanceLabel} />
          <BriefMetric label="Range" value={brief.rangeDisplay} sub="p25–p75" />
          {brief.readinessScore != null ? (
            <BriefMetric
              label="Readiness"
              value={String(brief.readinessScore)}
              sub={brief.readinessLabel ?? undefined}
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function BriefMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
      <p className="text-[11px] text-zinc-600">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-medium tabular-nums text-zinc-100",
          value.length > 12 ? "text-base" : "text-lg",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p> : null}
    </div>
  );
}
