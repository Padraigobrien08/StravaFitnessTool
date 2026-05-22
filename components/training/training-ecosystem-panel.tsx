"use client";

import type { TrainingEcosystemView } from "@/lib/training/ecosystemViewModel";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { cn } from "@/lib/utils";

function trendColor(t: "positive" | "neutral" | "warning") {
  if (t === "positive") return "text-teal-400";
  if (t === "warning") return "text-amber-400";
  return "text-zinc-400";
}

export function TrainingEcosystemPanel({
  data,
  className,
}: {
  data: TrainingEcosystemView;
  className?: string;
}) {
  if (!data.hasNonRunData && data.interferenceWarnings.length === 0) {
    return (
      <PanelChrome title="Training ecosystem" className={className}>
        <p className="text-sm text-zinc-500">
          Log bike, strength, yoga, and other sports on Strava to see cross-training
          load, durability support, and interference context alongside your runs.
        </p>
      </PanelChrome>
    );
  }

  return (
    <PanelChrome title="Training ecosystem" className={className} accent>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 max-w-2xl">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Profile · {data.archetypeLabel}
              <span className="text-zinc-600"> ({data.archetypeConfidence} confidence)</span>
            </p>
            {data.headline ? (
              <p className="text-sm text-zinc-300 leading-relaxed">{data.headline}</p>
            ) : null}
          </div>
          <ConfidenceBadge level={data.confidence} />
        </div>

        {data.modalityDistribution.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {data.modalityDistribution.map((m) => (
              <span
                key={m.modality}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[11px] text-zinc-500"
              >
                {m.label}{" "}
                <span className="text-zinc-300 tabular-nums">
                  {m.sessions}
                  {m.minutes > 0 ? ` · ${m.minutes}m` : ""}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="rounded-lg border border-white/[0.05] bg-black/20 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Cross-training load · {data.crossTrainingLoad.weekLabel}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8 text-center">
            <Stat label="Run volume" value={data.crossTrainingLoad.runKm} />
            <Stat
              label="Runs"
              value={String(data.crossTrainingLoad.runSessions)}
            />
            <Stat
              label="Bike"
              value={`${data.crossTrainingLoad.bikeMinutes}m`}
            />
            <Stat
              label="Swim"
              value={`${data.crossTrainingLoad.swimMinutes}m`}
            />
            <Stat
              label="Other aerobic"
              value={`${data.crossTrainingLoad.crossTrainingMinutes}m`}
            />
            <Stat
              label="Strength"
              value={String(data.crossTrainingLoad.strengthSessions)}
            />
            <Stat
              label="Mobility"
              value={String(data.crossTrainingLoad.mobilitySessions)}
            />
            <Stat
              label="HIIT/sport"
              value={String(data.crossTrainingLoad.hiitSessions)}
            />
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            {data.crossTrainingLoad.headline}
          </p>
        </div>

        {data.interferenceWarnings.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
              Interference (24–48h of quality runs)
            </p>
            {data.interferenceWarnings.map((w) => (
              <div
                key={w.id}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5"
              >
                <p className="text-sm font-medium text-amber-200/90">{w.title}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{w.message}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {data.supportCards.map((card) => (
            <div
              key={card.id}
              className="rounded-lg border border-white/[0.05] bg-black/15 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-200">{card.title}</p>
                <span className={cn("text-xs font-mono", trendColor(card.trend))}>
                  {card.score}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{card.detail}</p>
              {card.evidence.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-600">
                  {card.evidence.slice(0, 2).map((e, i) => (
                    <li key={i}>· {e}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        {(data.readinessContext || data.fatigueContext) && (
          <p className="text-xs text-zinc-500 border-t border-white/[0.04] pt-3">
            {data.readinessContext ?? data.fatigueContext}
          </p>
        )}

        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {data.limitations[0]} Running remains primary for race performance; non-run
          work informs fatigue and durability context only.
        </p>
      </div>
    </PanelChrome>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-zinc-200 tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
    </div>
  );
}
