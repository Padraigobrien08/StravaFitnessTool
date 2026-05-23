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
import type { PrTimelinePoint } from "@/lib/analytics/progression";
import { formatDuration } from "@/lib/utils";
import { useTrainingChart } from "@/components/training/charts/chart-theme";

const chartTick = { fontSize: 10, fill: "var(--chart-tick-fill)" };

const BUCKET_COLORS: Record<string, string> = {
  "5k": "#34d399",
  "10k": "#818cf8",
  hm: "#fbbf24",
};

function formatTimeTick(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PrProgressionChart({ timeline }: { timeline: PrTimelinePoint[] }) {
  const chart = useTrainingChart();
  const buckets = ["5k", "10k", "hm"] as const;
  const dates = [...new Set(timeline.map((p) => p.date))].sort();

  const chartData = dates.map((date) => {
    const row: Record<string, string | number> = {
      date,
      label: new Date(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    };
    for (const b of buckets) {
      const points = timeline.filter((p) => p.bucket === b && p.date <= date);
      const latest = points.at(-1);
      if (latest) row[b] = latest.timeSec;
    }
    return row;
  });

  const hasData = chartData.some((row) =>
    buckets.some((b) => typeof row[b] === "number")
  );

  if (!hasData) {
    return (
      <p className="text-sm text-zinc-500">
        No PR progression yet for 5K, 10K, or half marathon distances.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tick={chartTick} />
        <YAxis tick={chartTick} tickFormatter={formatTimeTick} reversed />
        <Tooltip
          contentStyle={chart.tooltip}
          formatter={(v) =>
            typeof v === "number" ? formatDuration(v) : String(v)
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {buckets.map((b) => (
          <Line
            key={b}
            type="stepAfter"
            dataKey={b}
            stroke={BUCKET_COLORS[b]}
            dot={{ r: 3 }}
            connectNulls
            name={b === "hm" ? "Half marathon" : b.toUpperCase()}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
