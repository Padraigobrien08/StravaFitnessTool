"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import type { RunsHeroView } from "@/lib/runs/viewModels";

export function RunHistoryHero({ hero }: { hero: RunsHeroView }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#0f1216] via-[#0c0e12] to-[#09090b] px-4 py-4 sm:px-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              {hero.title}
            </p>
            <ConfidenceBadge level={hero.confidence} />
            <span className="text-[10px] text-zinc-700">
              {hero.runCount} runs · {hero.totalKm}
            </span>
          </div>

          <div>
            <p className="text-[10px] text-zinc-600">Current identity</p>
            <p className="mt-0.5 text-[16px] font-medium leading-snug text-zinc-100 sm:text-[17px]">
              {hero.trainingIdentity}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-zinc-600">Current signals</p>
            <ul className="mt-1 space-y-0.5">
              {hero.signals.map((s) => (
                <li
                  key={s}
                  className="flex gap-2 text-[13px] text-zinc-400 before:content-['–']"
                >
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12px] text-zinc-500">
            <span className="text-zinc-600">Recent behavior: </span>
            {hero.recentBehavior}
          </p>
          <p className="text-[12px] text-zinc-500">
            <span className="text-zinc-600">Training emphasis: </span>
            {hero.trainingEmphasis}
          </p>
        </div>

        <aside className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            State
          </p>
          <dl className="mt-2 space-y-2 text-[11px]">
            <StateRow label="Readiness" value={hero.stateCard.readiness} />
            <StateRow label="Consistency" value={hero.stateCard.consistency} />
            <StateRow label="Easy share" value={hero.stateCard.easyShare} />
            <StateRow label="Frequency" value={hero.stateCard.frequency} />
            <StateRow label="Volume" value={hero.stateCard.volumeTrend} />
            <StateRow label="Phase" value={hero.stateCard.phase} />
          </dl>
        </aside>
      </div>
    </section>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="text-right text-zinc-300">{value}</dd>
    </div>
  );
}
