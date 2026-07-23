"use client";

import Link from "next/link";
import type { LimiterProtocolResult } from "@/lib/goals/limiterProtocols";
import { signalCoachLink } from "@/lib/coach/domainLinks";

export function IntelligenceLimiterProtocol({ data }: { data: LimiterProtocolResult }) {
  if (!data.available || !data.limiter || !data.protocol) return null;
  const { limiter, protocol } = data;

  return (
    <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] font-medium text-zinc-500">
        Targeted protocol
        <span className="ml-1.5 text-zinc-600">your limiter → the block that moves it</span>
      </p>

      <p className="mt-2 text-[13px] leading-snug text-zinc-300">
        <span className="text-zinc-600">Limiter:</span>{" "}
        <span className="font-medium text-amber-300/90">{limiter.label}</span>{" "}
        <span className="text-zinc-600">({limiter.score}/100)</span> →{" "}
        <span className="font-medium text-zinc-100">{protocol.title}</span>
      </p>

      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
        {protocol.weeks}-week block, ~{protocol.sessionsPerWeek}×/wk — {protocol.description}
      </p>

      {data.projectedTimeLabel ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] tabular-nums">
          <span className="text-zinc-500">
            Baseline <span className="text-zinc-300">{data.baselineTimeLabel}</span>
          </span>
          <span className="text-teal-400/90">
            → {data.projectedTimeLabel}
            {data.projectedGainSec != null && data.projectedGainSec > 0
              ? ` (−${data.projectedGainSec}s)`
              : ""}
          </span>
          {data.probabilityPct != null && data.targetLabel ? (
            <span className="text-zinc-500">
              {data.probabilityPct}% chance of {data.targetLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {data.evidence.length > 0 ? (
        <p className="mt-2 text-[11px] leading-snug text-zinc-500">{data.evidence[0]}</p>
      ) : null}

      {data.limitations.length > 0 ? (
        <p className="mt-1.5 text-[10px] leading-snug text-zinc-700">{data.limitations[0]}</p>
      ) : null}

      <Link
        href={signalCoachLink(
          `Build me a ${protocol.title.toLowerCase()} to fix my ${limiter.label.toLowerCase()} limiter.`,
        )}
        className="mt-2 inline-block text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        Ask Coach
      </Link>
    </section>
  );
}
