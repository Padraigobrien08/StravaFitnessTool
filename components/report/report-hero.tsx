"use client";

import { Sparkline } from "@/components/home/primitives/sparkline";
import type { ReportHeroView } from "@/lib/report/viewModels";

function ReportReadinessDial({ score }: { score: number }) {
  const color = score >= 70 ? "#0f766e" : score >= 50 ? "#b45309" : "#b91c1c";
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative inline-flex h-[96px] w-[96px] items-center justify-center">
      <svg width={96} height={96} className="-rotate-90">
        <circle cx={48} cy={48} r={r} fill="none" stroke="#e4e4e7" strokeWidth={7} />
        <circle
          cx={48}
          cy={48}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-bold tabular-nums text-zinc-900">{score}</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
          ready
        </span>
      </div>
    </div>
  );
}

export function ReportHero({ hero }: { hero: ReportHeroView }) {
  return (
    <div className="report-hero grid gap-6 rounded-2xl border border-zinc-200/90 bg-white p-6 print:break-inside-avoid print:border-zinc-300 sm:grid-cols-[1fr_220px] sm:p-8">
      <div className="min-w-0 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/90">
          Athlete state
        </p>
        <h2 className="font-display text-2xl font-bold text-zinc-900 print:text-black">
          {hero.athleteState}
        </h2>
        <p className="text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">Trajectory · </span>
          {hero.trajectory}
        </p>
        <p className="text-sm leading-relaxed text-zinc-700">
          <span className="font-medium text-zinc-900">Recommendation · </span>
          {hero.recommendation}
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-zinc-700 ring-1 ring-inset ring-zinc-200 print:bg-zinc-50">
            Readiness {hero.readinessLabel} ({hero.readinessScore})
          </span>
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-zinc-600 ring-1 ring-inset ring-zinc-200 print:bg-zinc-50">
            Confidence {hero.confidenceLabel}
          </span>
          {hero.raceLabel ? (
            <span className="rounded-md bg-accent px-2.5 py-1 text-accent ring-1 ring-inset ring-accent/80">
              {hero.raceLabel}
            </span>
          ) : null}
        </div>
      </div>
      <aside className="flex flex-col items-center gap-4 rounded-xl bg-zinc-50/80 p-4 print:bg-zinc-50">
        <ReportReadinessDial score={hero.readinessScore} />
        <div className="w-full">
          <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-zinc-500">
            Volume rhythm
          </p>
          <Sparkline
            data={hero.volumeSparkline}
            fullWidth
            height={36}
            stroke="#0f766e"
            fill="rgba(15,118,110,0.12)"
          />
        </div>
        {hero.daysUntilRace != null ? (
          <p className="text-center text-xs text-zinc-600">
            {hero.daysUntilRace === 0 ? "Race day" : `${hero.daysUntilRace} days to race`}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
