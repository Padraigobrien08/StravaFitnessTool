"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { Eyebrow, Panel } from "@/components/console/console-kit";
import type { RunsHeroView } from "@/lib/runs/viewModels";

export function RunHistoryHero({ hero }: { hero: RunsHeroView }) {
  return (
    <Panel className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,var(--home-signal-wash),transparent_55%)]" />
      <div className="relative grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>{hero.title}</Eyebrow>
            <ConfidenceBadge level={hero.confidence} />
            <span className="font-mono text-[10px] tabular-nums text-zinc-500">
              {hero.runCount} runs · {hero.totalKm}
            </span>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              Current identity
            </p>
            <p className="mt-0.5 text-[16px] font-medium leading-snug text-foreground sm:text-[17px]">
              {hero.trainingIdentity}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Current signals</p>
            <ul className="mt-1 space-y-0.5">
              {hero.signals.map((s) => (
                <li
                  key={s}
                  className="flex gap-2 text-[13px] text-muted-foreground before:text-zinc-600 before:content-['–']"
                >
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12px] text-zinc-500">
            <span className="text-zinc-400">Recent behavior: </span>
            {hero.recentBehavior}
          </p>
          <p className="text-[12px] text-zinc-500">
            <span className="text-zinc-400">Training emphasis: </span>
            {hero.trainingEmphasis}
          </p>
        </div>

        <aside className="rounded-lg bg-[var(--surface-subdued)] p-3 ring-1 ring-[var(--border-subtle)]">
          <Eyebrow>State</Eyebrow>
          <dl className="mt-2 space-y-2 text-[11px]">
            <StateRow label="Readiness" value={hero.stateCard.readiness} />
            <StateRow label="Consistency" value={hero.stateCard.consistency} />
            <StateRow label="Low-intensity" value={hero.stateCard.easyShare} />
            <StateRow label="Frequency" value={hero.stateCard.frequency} />
            <StateRow label="Volume" value={hero.stateCard.volumeTrend} />
            <StateRow label="Phase" value={hero.stateCard.phase} />
          </dl>
        </aside>
      </div>
    </Panel>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-mono tabular-nums text-zinc-300">{value}</dd>
    </div>
  );
}
