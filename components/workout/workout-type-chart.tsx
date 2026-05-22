"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkoutTypeBucket } from "@/lib/analytics/workoutType";

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fafafa",
};

const TYPE_COLORS: Record<string, string> = {
  Easy: "#34d399",
  Recovery: "#38bdf8",
  "Long run": "#818cf8",
  Tempo: "#fbbf24",
  Interval: "#f87171",
  Race: "#e879f9",
  Unknown: "#71717a",
};

export function WorkoutTypeChart({ data }: { data: WorkoutTypeBucket[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No runs in the last 8 weeks.</p>
    );
  }

  const chartData = data.map((d) => ({
    label: d.label,
    pct: Math.round(d.pct * 10) / 10,
    runCount: d.runCount,
    fill: TYPE_COLORS[d.label] ?? "#71717a",
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} unit="%" />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          width={72}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, _name, props) => {
            const payload = props.payload as { runCount: number };
            return [
              `${value}% (${payload.runCount} runs)`,
              "Share",
            ];
          }}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} name="Share">
          {chartData.map((entry) => (
            <Cell key={entry.label} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
