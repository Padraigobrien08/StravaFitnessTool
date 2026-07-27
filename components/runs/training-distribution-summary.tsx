"use client";

import type { TrainingDistributionView } from "@/lib/runs/viewModels";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import type { WorkoutType } from "@/lib/analytics/workoutType";
import { cn } from "@/lib/utils";

const barColors: Record<WorkoutType, string> = {
  easy: "bg-accent/60",
  recovery: "bg-zinc-500/50",
  long: "bg-blue-500/55",
  tempo: "bg-amber-500/55",
  interval: "bg-amber-400/70",
  race: "bg-fuchsia-500/50",
  unknown: "bg-white/20",
};

export function TrainingDistributionSummary({ data }: { data: TrainingDistributionView }) {
  return (
    <section className="rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5">
      <p className="text-[10px] font-medium text-zinc-600">
        Training distribution · operational strip
      </p>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
        {data.mix.map((m) => (
          <div
            key={m.type}
            className={cn(barColors[m.type])}
            style={{ width: `${Math.max(m.pct, 2)}%` }}
            title={`${WORKOUT_TYPE_LABELS[m.type]} ${m.pct}%`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">{data.intensityLine}</p>
      <div className="mt-2 grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
        <StripItem label="Frequency" value={data.frequencyLine} />
        <StripItem label="Long-run rhythm" value={data.longRunRhythm} />
        <StripItem label="Hard-session density" value={data.intervalDensity} />
        <StripItem label="Weekly consistency" value={data.consistencyLine} />
        <StripItem label="Modality" value={data.modalityLine} />
      </div>
    </section>
  );
}

function StripItem({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-zinc-600">
      <span className="text-zinc-500">{label}: </span>
      <span className="text-zinc-400">{value}</span>
    </p>
  );
}
