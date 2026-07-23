"use client";

import type {
  UncertaintyEstimate,
  UncertaintyEstimates,
} from "@/lib/analytics/uncertaintyEstimates";

function fmt(value: number, key: UncertaintyEstimate["key"]): string {
  if (key === "aerobic_efficiency") return value.toFixed(3);
  if (key === "easy_pace") {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return String(Math.round(value));
}

export function IntelligenceUncertainty({ data }: { data: UncertaintyEstimates }) {
  if (!data.available || data.estimates.length === 0) return null;

  return (
    <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] font-medium text-zinc-500">
        Current form · with intervals
        <span className="ml-1.5 text-zinc-600">bootstrapped from your own recent runs</span>
      </p>

      <ul className="mt-2 space-y-2">
        {data.estimates.map((e) => {
          // Pace lo/hi read fastest→slowest; keep the numeric order stable in display.
          const lo = fmt(Math.min(e.lo, e.hi), e.key);
          const hi = fmt(Math.max(e.lo, e.hi), e.key);
          return (
            <li key={e.key} className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="text-zinc-400">{e.label}</span>
              <span className="tabular-nums text-zinc-500">
                <span className="font-medium text-zinc-200">
                  {fmt(e.point, e.key)}
                  {e.unit ? ` ${e.unit}` : ""}
                </span>
                <span className="ml-1.5 text-zinc-600">
                  {e.ciPct}% CI {lo}–{hi} · n={e.n}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {data.limitations.length > 0 ? (
        <p className="mt-2 text-[10px] leading-snug text-zinc-700">{data.limitations[0]}</p>
      ) : null}
    </section>
  );
}
