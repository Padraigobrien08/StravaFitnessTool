"use client";

import type {
  UncertaintyEstimate,
  UncertaintyEstimates,
} from "@/lib/analytics/uncertaintyEstimates";
import { JargonTerm } from "@/components/jargon-term";
import { Panel } from "@/components/ui/panel";

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
    <Panel title="Current form · with intervals" hint="bootstrapped from your own recent runs">
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
                  {e.ciPct}% <JargonTerm term="ci">CI</JargonTerm> {lo}–{hi} · n={e.n}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {data.limitations.length > 0 ? (
        <p className="mt-2 text-[10px] leading-snug text-zinc-700">{data.limitations[0]}</p>
      ) : null}
    </Panel>
  );
}
