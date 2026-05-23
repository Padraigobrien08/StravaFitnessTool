"use client";

import { useMemo } from "react";
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
import { minMaxYDomain } from "@/lib/charts/yDomain";
import { formatDuration } from "@/lib/utils";
import { useTrainingChart } from "@/components/training/charts/chart-theme";

const chartTick = { fontSize: 10, fill: "var(--chart-tick-fill)" };

export type PredictionTrendSeriesKey = "5K" | "10K" | "HM";

const SERIES: {
  key: PredictionTrendSeriesKey;
  dataKey: "5K" | "10K" | "HM";
  color: string;
}[] = [
  { key: "5K", dataKey: "5K", color: "#34d399" },
  { key: "10K", dataKey: "10K", color: "#818cf8" },
  { key: "HM", dataKey: "HM", color: "#fbbf24" },
];

function formatTimeTick(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function valuesForSeries(
  timeline: PredictionTimelinePoint[],
  dataKey: "5K" | "10K" | "HM"
): number[] {
  const field =
    dataKey === "5K"
      ? "consensus5kSec"
      : dataKey === "10K"
        ? "consensus10kSec"
        : "consensusHmSec";
  return timeline
    .map((p) => p[field])
    .filter((v): v is number => v != null && v > 0);
}

export function PredictionTrendChart({
  timeline,
  seriesKeys,
}: {
  timeline: PredictionTimelinePoint[];
  /** When set, only these distances are drawn (avoids 5K/10K flattening HM scale). */
  seriesKeys?: PredictionTrendSeriesKey[];
}) {
  const chart = useTrainingChart();
  const activeSeries = useMemo(() => {
    const keys = seriesKeys ?? (["5K", "10K", "HM"] as PredictionTrendSeriesKey[]);
    return SERIES.filter((s) => keys.includes(s.key));
  }, [seriesKeys]);

  const chartData = useMemo(
    () =>
      timeline.map((p) => ({
        label: p.label,
        "5K": p.consensus5kSec ?? undefined,
        "10K": p.consensus10kSec ?? undefined,
        HM: p.consensusHmSec ?? undefined,
      })),
    [timeline]
  );

  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const s of activeSeries) {
      vals.push(...valuesForSeries(timeline, s.dataKey));
    }
    return minMaxYDomain(vals, {
      paddingPct: 0.08,
      paddingMin: 45,
      filterOutliers: true,
    });
  }, [timeline, activeSeries]);

  if (timeline.length < 2) {
    return (
      <p className="text-sm text-zinc-500">
        Need more training history to show prediction trends (sampled every 4
        weeks).
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tick={chartTick} />
        <YAxis
          domain={yDomain}
          allowDataOverflow
          tick={chartTick}
          tickFormatter={formatTimeTick}
          reversed
        />
        <Tooltip
          contentStyle={chart.tooltip}
          formatter={(v) =>
            typeof v === "number" ? formatDuration(v) : String(v)
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {activeSeries.map((s) => (
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            stroke={s.color}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
