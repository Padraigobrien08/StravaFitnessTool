"use client";

import type { ChangePoint, ChangePointReport } from "@/lib/analytics/changePoints";
import { cn } from "@/lib/utils";
import { JargonTerm } from "@/components/jargon-term";
import { Panel } from "@/components/ui/panel";
import { TrendingDown, TrendingUp } from "lucide-react";

const KIND_META: Record<ChangePoint["kind"], { label: string; tone: string }> = {
  reversal_up: { label: "build took hold", tone: "text-[var(--home-good)]" },
  acceleration: { label: "ramp steepened", tone: "text-[var(--home-good)]" },
  reversal_down: { label: "peak → decline", tone: "text-amber-300/90" },
  deceleration: { label: "gains flattened", tone: "text-amber-300/90" },
};

export function IntelligenceChangePoints({ data }: { data: ChangePointReport }) {
  if (!data.available || data.changePoints.length === 0) return null;

  return (
    <Panel
      title="Fitness change-points"
      hint={<>where your {data.metricLabel} trajectory turned</>}
    >
      <ul className="mt-2 space-y-2">
        {data.changePoints.map((c, i) => (
          <ChangePointRow key={`${c.weekStart}-${i}`} cp={c} />
        ))}
      </ul>

      {data.limitations.length > 0 ? (
        <p className="mt-2 text-[10px] leading-snug text-zinc-700">{data.limitations[0]}</p>
      ) : null}
    </Panel>
  );
}

function ChangePointRow({ cp }: { cp: ChangePoint }) {
  const meta = KIND_META[cp.kind];
  const up = cp.kind === "reversal_up" || cp.kind === "acceleration";
  return (
    <li className="flex items-baseline gap-2 text-[12px] leading-snug">
      <span className="mt-0.5 shrink-0">
        {up ? (
          <TrendingUp className="h-3 w-3 text-[var(--home-good)]" />
        ) : (
          <TrendingDown className="h-3 w-3 text-amber-400/70" />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-zinc-300">
          <span className="text-zinc-500">{cp.label}</span> ·{" "}
          <span className={cn(meta.tone)}>{meta.label}</span>
        </p>
        <p className="text-[10px] tabular-nums text-zinc-600">
          slope {cp.slopeBefore >= 0 ? "+" : ""}
          {cp.slopeBefore} → {cp.slopeAfter >= 0 ? "+" : ""}
          {cp.slopeAfter} <JargonTerm term="ctl">CTL</JargonTerm>/wk
        </p>
      </div>
    </li>
  );
}
