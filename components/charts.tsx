"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTrainingChart } from "@/components/training/charts/chart-theme";

const chartTick = { fontSize: 11, fill: "var(--chart-tick-fill)" };
const CHART_GRID = "var(--chart-grid)";

function useChartTooltip() {
  return useTrainingChart().tooltip;
}

export function VolumeChart({
  data,
}: {
  data: { label: string; distanceKm: number; runCount: number }[];
}) {
  const tooltipStyle = useChartTooltip();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="label" tick={chartTick} interval="preserveStartEnd" />
        <YAxis tick={chartTick} unit=" km" />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="distanceKm" fill="#10b981" radius={[4, 4, 0, 0]} name="Distance (km)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaceChart({
  data,
  rolling,
}: {
  data: { label: string; paceSecPerKm: number; date?: string }[];
  rolling?: { label: string; rollingPaceSecPerKm: number; date: string }[];
}) {
  const formatPaceTick = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const rollingByDate = new Map(
    (rolling ?? []).map((r) => [r.date, r.rollingPaceSecPerKm])
  );

  const tooltipStyle = useChartTooltip();
  const chartData = data.map((d) => ({
    label: d.label,
    pace: d.paceSecPerKm,
    rolling: d.date ? rollingByDate.get(d.date) : undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="label" tick={chartTick} interval="preserveStartEnd" />
        <YAxis
          tick={chartTick}
          reversed
          domain={["auto", "auto"]}
          tickFormatter={formatPaceTick}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [
            typeof v === "number" ? formatPaceTick(v) + "/km" : "—",
            "Pace",
          ]}
        />
        <Line
          type="monotone"
          dataKey="pace"
          stroke="#34d399"
          dot={{ r: 3, fill: "#10b981" }}
          name="Run pace"
        />
        {rolling && rolling.length > 0 && (
          <Line
            type="monotone"
            dataKey="rolling"
            stroke="#fbbf24"
            strokeDasharray="5 5"
            dot={false}
            name="4-run avg"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HrChart({
  data,
}: {
  data: { label: string; avgHr: number }[];
}) {
  const tooltipStyle = useChartTooltip();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="label" tick={chartTick} interval="preserveStartEnd" />
        <YAxis tick={chartTick} domain={["auto", "auto"]} unit=" bpm" />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="avgHr" stroke="#f87171" dot={{ r: 2 }} name="Avg HR" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LoadChart({
  data,
}: {
  data: { label: string; trainingLoad: number | null }[];
}) {
  const tooltipStyle = useChartTooltip();
  const filtered = data.filter((d) => d.trainingLoad !== null);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={filtered}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="label" tick={chartTick} interval="preserveStartEnd" />
        <YAxis tick={chartTick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="trainingLoad"
          stroke="#818cf8"
          fill="#6366f1"
          fillOpacity={0.3}
          name="Training load"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FitnessChart({
  data,
}: {
  data: { label: string; ctl: number }[];
}) {
  const tooltipStyle = useChartTooltip();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="label" tick={chartTick} interval="preserveStartEnd" />
        <YAxis tick={chartTick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="ctl"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.2}
          name="Fitness index"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FatigueChart({
  data,
}: {
  data: { label: string; ctl: number; atl: number }[];
}) {
  const tooltipStyle = useChartTooltip();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="label" tick={chartTick} interval="preserveStartEnd" />
        <YAxis tick={chartTick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="ctl"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.15}
          name="CTL (chronic)"
        />
        <Area
          type="monotone"
          dataKey="atl"
          stroke="#fbbf24"
          fill="#fbbf24"
          fillOpacity={0.1}
          name="ATL (acute)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ZoneBarChart({
  data,
}: {
  data: { zone: string; label: string; pct: number; runCount: number }[];
}) {
  const tooltipStyle = useChartTooltip();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis type="number" tick={chartTick} unit="%" />
        <YAxis type="category" dataKey="zone" tick={chartTick} width={32} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="pct" fill="#10b981" radius={[0, 4, 4, 0]} name="% of runs" />
      </BarChart>
    </ResponsiveContainer>
  );
}
