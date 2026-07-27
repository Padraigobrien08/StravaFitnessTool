"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTrainingChart } from "./chart-theme";

export function LoadIntelligenceChart({
  data,
  currentIndex,
}: {
  data: { label: string; ctl: number; atl: number; tsb: number }[];
  currentIndex: number;
}) {
  const chart = useTrainingChart();
  const accent = "var(--home-signal)";

  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-xs text-zinc-600">
        Need more weekly history for load trends.
      </p>
    );
  }

  const current = data[currentIndex] ?? data.at(-1)!;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ctlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="atlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chart.amber} stopOpacity={0.25} />
            <stop offset="100%" stopColor={chart.amber} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chart.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={chart.tick}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={chart.tick} width={32} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={chart.tooltip} />
        <Area
          type="monotone"
          dataKey="ctl"
          stroke={accent}
          fill="url(#ctlGrad)"
          strokeWidth={2}
          name="Fitness (CTL)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="atl"
          stroke={chart.amber}
          fill="url(#atlGrad)"
          strokeWidth={1.5}
          name="Fatigue (ATL)"
          dot={false}
        />
        <ReferenceDot
          x={current.label}
          y={current.atl}
          r={5}
          fill={chart.amber}
          stroke="var(--background)"
          strokeWidth={2}
        />
        <ReferenceDot
          x={current.label}
          y={current.ctl}
          r={5}
          fill={accent}
          stroke="var(--background)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
