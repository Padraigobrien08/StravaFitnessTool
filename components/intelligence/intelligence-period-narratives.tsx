"use client";

import type { MonthlyNarrative, PreRaceNarrative } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const severityAccent = {
  positive:
    "[border-color:color-mix(in_srgb,var(--home-good)_22%,transparent)] [background-color:color-mix(in_srgb,var(--home-good)_4%,transparent)]",
  neutral: "border-white/[0.06] bg-white/[0.02]",
  warning: "border-amber-500/20 bg-amber-500/[0.03]",
};

export function IntelligencePeriodNarratives({
  monthly,
  preRace,
}: {
  monthly: MonthlyNarrative;
  preRace: PreRaceNarrative | null;
}) {
  return (
    <div className="space-y-3">
      {preRace ? (
        <section className={cn("rounded-lg border px-3 py-3", severityAccent[preRace.severity])}>
          <p className="text-[11px] font-medium text-zinc-500">Race lead-in</p>
          <p className="mt-1 text-[13px] font-semibold text-zinc-200">{preRace.headline}</p>
          <div className="mt-1.5 space-y-1.5">
            {preRace.paragraphs.map((p, i) => (
              <p key={i} className="text-[12px] leading-snug text-zinc-400">
                {p}
              </p>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-snug text-accent">
            <span className="text-zinc-500">Game plan: </span>
            {preRace.gamePlan}
          </p>
        </section>
      ) : null}

      {monthly.paragraphs.length > 0 ? (
        <section className={cn("rounded-lg border px-3 py-3", severityAccent[monthly.severity])}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-medium text-zinc-500">Monthly recap</p>
            <p className="text-[10px] text-zinc-600">{monthly.monthLabel}</p>
          </div>
          <p className="mt-1 text-[13px] font-semibold text-zinc-200">{monthly.headline}</p>
          <div className="mt-1.5 space-y-1.5">
            {monthly.paragraphs.map((p, i) => (
              <p key={i} className="text-[12px] leading-snug text-zinc-400">
                {p}
              </p>
            ))}
          </div>
          {monthly.highlights.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {monthly.highlights.map((h, i) => (
                <span
                  key={i}
                  className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-400"
                >
                  {h}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
