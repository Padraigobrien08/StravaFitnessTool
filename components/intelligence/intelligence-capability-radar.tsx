"use client";

import Link from "next/link";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { CapabilityRadar } from "@/lib/analytics/capabilityRadar";
import { signalCoachLink } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";

export function IntelligenceCapabilityRadar({ data }: { data: CapabilityRadar }) {
  if (!data.available) return null;

  const chartData = data.axes.map((a) => ({
    axis: a.label,
    score: a.score,
    demand: a.demandImportance != null ? Math.round(a.demandImportance * 100) : null,
    isLimiter: a.isLimiter,
  }));
  const hasDemand = chartData.some((d) => d.demand != null);

  return (
    <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] font-medium text-zinc-500">
        Capability radar
        <span className="ml-1.5 text-zinc-600">
          {data.goalDistanceLabel
            ? `scored vs your history, weighted for your ${data.goalDistanceLabel}`
            : "scored vs your own history"}
        </span>
      </p>

      <div className="mt-1 h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="72%">
            <PolarGrid stroke="var(--chart-grid, rgba(255,255,255,0.08))" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 10, fill: "var(--chart-tick-fill, #a1a1aa)" }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {hasDemand ? (
              <Radar
                name="Race demand"
                dataKey="demand"
                stroke="rgba(161,161,170,0.5)"
                fill="rgba(161,161,170,0.12)"
                fillOpacity={1}
              />
            ) : null}
            <Radar name="You" dataKey="score" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.28} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {data.biggestLimiter ? (
        <p className="text-[12px] leading-snug text-zinc-400">
          Biggest limiter:{" "}
          <span className="font-medium text-amber-300/90">{data.biggestLimiter.label}</span>{" "}
          <span className="text-zinc-600">
            ({data.biggestLimiter.score}/100) — {data.biggestLimiter.evidence}
          </span>
        </p>
      ) : (
        <p className="text-[12px] leading-snug text-zinc-500">{data.interpretation}</p>
      )}

      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {data.axes.map((a) => (
          <li key={a.key} className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className={cn("text-zinc-500", a.isLimiter && "text-amber-300/80")}>
              {a.label}
            </span>
            <span className="tabular-nums text-zinc-400">
              {a.score}
              <span className="text-zinc-600">/100</span>
            </span>
          </li>
        ))}
      </ul>

      {data.limitations.length > 0 ? (
        <p className="mt-1.5 text-[10px] leading-snug text-zinc-700">{data.limitations[0]}</p>
      ) : null}

      <Link
        href={signalCoachLink(
          data.biggestLimiter
            ? `What should I do about my biggest limiter (${data.biggestLimiter.label}) for my race?`
            : "Explain my capability radar and what to work on.",
        )}
        className="mt-2 inline-block text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        Ask Coach
      </Link>
    </section>
  );
}
