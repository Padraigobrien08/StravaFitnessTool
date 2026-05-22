"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { PredictionTimelinePoint } from "@/lib/analytics/progression";
import { formatDuration } from "@/lib/utils";

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fafafa",
};

function formatTimeTick(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PredictionTrendChart({
  timeline,
}: {
  timeline: PredictionTimelinePoint[];
}) {
  if (timeline.length < 2) {
    return (
      <p className="text-sm text-zinc-500">
        Need more training history to show prediction trends (sampled every 4
        weeks).
      </p>
    );
  }

  const chartData = timeline.map((p) => ({
    label: p.label,
    "5K": p.consensus5kSec ?? undefined,
    "10K": p.consensus10kSec ?? undefined,
    HM: p.consensusHmSec ?? undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
        <YAxis
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickFormatter={formatTimeTick}
          reversed
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) =>
            typeof v === "number" ? formatDuration(v) : String(v)
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="5K"
          stroke="#34d399"
          dot={{ r: 2 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="10K"
          stroke="#818cf8"
          dot={{ r: 2 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="HM"
          stroke="#fbbf24"
          dot={{ r: 2 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
