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
import { trainingChart } from "./chart-theme";

export function LoadIntelligenceChart({
  data,
  currentIndex,
}: {
  data: { label: string; ctl: number; atl: number; tsb: number }[];
  currentIndex: number;
}) {
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
            <stop offset="0%" stopColor={trainingChart.teal} stopOpacity={0.35} />
            <stop offset="100%" stopColor={trainingChart.teal} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="atlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trainingChart.amber} stopOpacity={0.25} />
            <stop offset="100%" stopColor={trainingChart.amber} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={trainingChart.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={trainingChart.tick}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={trainingChart.tick}
          width={32}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={trainingChart.tooltip} />
        <Area
          type="monotone"
          dataKey="ctl"
          stroke={trainingChart.teal}
          fill="url(#ctlGrad)"
          strokeWidth={2}
          name="Fitness (CTL)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="atl"
          stroke={trainingChart.amber}
          fill="url(#atlGrad)"
          strokeWidth={1.5}
          name="Fatigue (ATL)"
          dot={false}
        />
        <ReferenceDot
          x={current.label}
          y={current.atl}
          r={5}
          fill={trainingChart.amber}
          stroke="#09090b"
          strokeWidth={2}
        />
        <ReferenceDot
          x={current.label}
          y={current.ctl}
          r={5}
          fill={trainingChart.teal}
          stroke="#09090b"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
