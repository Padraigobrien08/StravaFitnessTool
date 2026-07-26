"use client";

import Link from "next/link";
import type { Anomaly, AnomalyReport } from "@/lib/analytics/anomalies";
import { signalCoachLink } from "@/lib/coach/domainLinks";
import { JargonTerm } from "@/components/jargon-term";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

const CAUSE_LABEL: Record<Anomaly["likelyCauses"][number]["cause"], string> = {
  heat: "heat",
  terrain: "terrain",
  fatigue: "fatigue",
  unexplained: "unexplained",
  favorable: "favorable",
};

export function IntelligenceAnomalies({ data }: { data: AnomalyReport }) {
  if (!data.available || data.anomalies.length === 0) return null;

  return (
    <Panel title="Anomalies" hint="runs that don't fit your model — and why">
      <ul className="mt-2 space-y-2">
        {data.anomalies.slice(0, 5).map((a) => (
          <AnomalyRow key={a.runId} anomaly={a} />
        ))}
      </ul>

      {data.limitations.length > 0 ? (
        <p className="mt-2 text-[10px] leading-snug text-zinc-700">{data.limitations[0]}</p>
      ) : null}

      <Link
        href={signalCoachLink("Which recent runs didn't fit my normal pattern, and why?")}
        className="mt-2 inline-block text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        Ask Coach
      </Link>
    </Panel>
  );
}

function AnomalyRow({ anomaly }: { anomaly: Anomaly }) {
  const z = anomaly.z;
  const sigmaColor = anomaly.direction === "over" ? "text-[var(--home-good)]" : "text-amber-300/90";
  return (
    <li className="flex items-baseline gap-2 text-[12px] leading-snug">
      <span className={cn("w-12 shrink-0 font-medium tabular-nums", sigmaColor)}>
        {z >= 0 ? "+" : "−"}
        {Math.abs(z).toFixed(1)}
        <JargonTerm term="sigma">σ</JargonTerm>
      </span>
      <div className="min-w-0">
        <p className="text-zinc-300">
          <span className="text-zinc-500">{anomaly.date.slice(0, 10)}</span> · {anomaly.typeLabel}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {anomaly.likelyCauses.map((c, i) => (
            <span
              key={i}
              className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500"
              title={c.detail}
            >
              {CAUSE_LABEL[c.cause]}
              {c.cause !== "unexplained" && c.cause !== "favorable" ? ` · ${c.detail}` : ""}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}
