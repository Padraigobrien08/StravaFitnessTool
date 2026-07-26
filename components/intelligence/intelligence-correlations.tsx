"use client";

import type { Correlation, CorrelationReport } from "@/lib/analytics/correlations";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

const STRENGTH_STYLE: Record<Correlation["strength"], string> = {
  strong: "text-zinc-200",
  moderate: "text-zinc-300",
  weak: "text-zinc-500",
  none: "text-zinc-600",
};

export function IntelligenceCorrelations({ data }: { data: CorrelationReport }) {
  if (!data.available || data.correlations.length === 0) return null;

  return (
    <Panel title="Correlation explorer" hint="associations in your own data">
      <ul className="mt-2 space-y-1.5">
        {data.correlations.slice(0, 6).map((c) => (
          <CorrelationRow key={c.key} c={c} />
        ))}
      </ul>

      <p className="mt-2 text-[10px] leading-snug text-zinc-700">
        {data.limitations[0] ?? "Correlation is not causation."}
      </p>
    </Panel>
  );
}

function CorrelationRow({ c }: { c: Correlation }) {
  const rColor =
    c.direction === "positive"
      ? "text-[var(--home-good)]"
      : c.direction === "negative"
        ? "text-amber-300/80"
        : "text-zinc-600";
  return (
    <li className="text-[12px] leading-snug">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn(STRENGTH_STYLE[c.strength])}>{c.label}</span>
        <span className="shrink-0 tabular-nums text-zinc-500">
          <span className={rColor}>
            r={c.r >= 0 ? "+" : "−"}
            {Math.abs(c.r).toFixed(2)}
          </span>{" "}
          <span className="text-zinc-600">· n={c.n}</span>
        </span>
      </div>
      <p className="text-[10px] text-zinc-600">
        {c.strength === "none"
          ? "no meaningful association"
          : c.interpretation.split("—").slice(1).join("—").trim() || `${c.strength} ${c.direction}`}
      </p>
    </li>
  );
}
