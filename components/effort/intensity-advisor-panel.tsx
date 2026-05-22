"use client";

import { WhatThisMeans } from "@/components/layout/what-this-means";
import type { IntensityAdvice } from "@/lib/analytics/intensityAdvisor";

const statusLabel: Record<IntensityAdvice["status"], string> = {
  balanced: "Balanced",
  too_hard: "Too intensity-heavy",
  too_easy: "Mostly easy",
  insufficient_data: "Need more recent data",
};

const statusColor: Record<IntensityAdvice["status"], string> = {
  balanced: "text-emerald-400",
  too_hard: "text-amber-400",
  too_easy: "text-zinc-400",
  insufficient_data: "text-zinc-500",
};

export function IntensityAdvisorPanel({ advice }: { advice: IntensityAdvice }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Intensity advisor
        </p>
        <p className={`mt-2 text-lg font-medium ${statusColor[advice.status]}`}>
          {statusLabel[advice.status]}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          {advice.currentEasyPct.toFixed(0)}% easy runs (lifetime, HR runs only) ·
          target ~{advice.easyTargetPct}% easy · {advice.hardRunsLast14d} hard
          runs in last 14 days
        </p>
        {advice.recommendations.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {advice.recommendations.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        )}
        {advice.suggestedWeekPlan.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Suggested focus
            </p>
            <ul className="mt-2 space-y-2">
              {advice.suggestedWeekPlan.map((s, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-300">{s.type}: </span>
                  <span className="text-zinc-500">{s.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <WhatThisMeans formula="Easy: avg HR &lt; 80% max · Hard: avg HR ≥ 80% max">
        Easy vs hard uses average HR per run as a proxy — not time-in-zone from
        FIT streams. Polarized training typically targets most volume easy.
      </WhatThisMeans>
    </div>
  );
}
