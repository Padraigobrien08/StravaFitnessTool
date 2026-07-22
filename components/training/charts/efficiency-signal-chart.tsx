"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTrainingChart } from "./chart-theme";

export function EfficiencySignalChart({
  data,
  positive,
}: {
  data: { label: string; efficiency: number }[];
  positive?: boolean;
}) {
  const chart = useTrainingChart();

  if (data.length < 3) {
    return (
      <p className="py-6 text-center text-xs text-zinc-600">
        Need more HR-backed runs for efficiency trend.
      </p>
    );
  }

  const stroke = positive === false ? chart.amber : chart.teal;
  const last = data.at(-1)!;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
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
        <YAxis
          tick={chart.tick}
          width={36}
          axisLine={false}
          tickLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip contentStyle={chart.tooltip} />
        <Area type="monotone" dataKey="efficiency" stroke="none" fill="url(#effGrad)" />
        <Line
          type="monotone"
          dataKey="efficiency"
          stroke={stroke}
          strokeWidth={2}
          dot={false}
          name="Efficiency index"
        />
        <ReferenceDot
          x={last.label}
          y={last.efficiency}
          r={4}
          fill={stroke}
          stroke="var(--background)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
