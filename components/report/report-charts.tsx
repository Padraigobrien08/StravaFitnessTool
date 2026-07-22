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
  Legend,
} from "recharts";
import type { DashboardInsights } from "@/lib/analytics";
import type { ReportChartSpec } from "@/lib/report/viewModels";
import { PredictionTrendChart } from "@/components/progression/prediction-trend-chart";
import { useUnitFormat } from "@/hooks/use-unit-format";
import { distanceValueIn } from "@/lib/units";

const printTick = { fontSize: 9, fill: "#52525b" };
const printGrid = "rgba(0,0,0,0.08)";

const printTooltip = {
  backgroundColor: "#fff",
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  fontSize: 11,
  color: "#18181b",
};

export function ReportChartBlock({
  spec,
  analytics,
}: {
  spec: ReportChartSpec;
  analytics: DashboardInsights;
}) {
  const { distanceUnit, distanceLabel } = useUnitFormat();
  let chart: React.ReactNode = null;

  if (spec.id === "load" && analytics.loadHistory.length >= 3) {
    const data = analytics.loadHistory.map((h) => ({
      label: h.label,
      CTL: Math.round(h.ctl),
      ATL: Math.round(h.atl),
    }));
    chart = (
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid stroke={printGrid} vertical={false} />
          <XAxis dataKey="label" tick={printTick} axisLine={false} tickLine={false} />
          <YAxis tick={printTick} axisLine={false} tickLine={false} width={32} />
          <Tooltip contentStyle={printTooltip} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="CTL" stroke="#0f766e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ATL" stroke="#a16207" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (spec.id === "efficiency" && analytics.efficiencyTrend.length >= 4) {
    const data = analytics.efficiencyTrend.slice(-14).map((p) => ({
      label: p.label,
      index: Math.round(p.efficiency * 100) / 100,
    }));
    chart = (
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <CartesianGrid stroke={printGrid} vertical={false} />
          <XAxis dataKey="label" tick={printTick} axisLine={false} tickLine={false} />
          <YAxis tick={printTick} axisLine={false} tickLine={false} width={36} reversed />
          <Tooltip contentStyle={printTooltip} />
          <Area
            type="monotone"
            dataKey="index"
            stroke="#0f766e"
            fill="rgba(15,118,110,0.12)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (spec.id === "prediction" && analytics.predictionTimeline.length >= 2) {
    chart = (
      <div className="h-[180px] [&_.recharts-cartesian-grid-horizontal line]:stroke-zinc-200">
        <PredictionTrendChart timeline={analytics.predictionTimeline} />
      </div>
    );
  }

  if (spec.id === "volume") {
    const data = analytics.weeklyVolume.slice(-10).map((w) => ({
      label: w.label,
      dist: Math.round(distanceValueIn(w.distanceKm, distanceUnit) * 10) / 10,
    }));
    chart = (
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <CartesianGrid stroke={printGrid} vertical={false} />
          <XAxis dataKey="label" tick={printTick} axisLine={false} tickLine={false} />
          <YAxis tick={printTick} axisLine={false} tickLine={false} width={32} />
          <Tooltip contentStyle={printTooltip} formatter={(v) => `${v} ${distanceLabel}`} />
          <Bar dataKey="dist" fill="#0f766e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (!chart) return null;

  return (
    <figure className="report-chart print:break-inside-avoid">
      <figcaption className="mb-3">
        <h4 className="text-sm font-semibold text-zinc-900">{spec.title}</h4>
        <p className="mt-0.5 text-xs text-zinc-600">{spec.caption}</p>
      </figcaption>
      <div className="rounded-lg border border-zinc-200 bg-white p-2 print:border-zinc-300">
        {chart}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-600 italic">
        Why it matters: {spec.whyItMatters}
      </p>
    </figure>
  );
}

export function ReportChartsGrid({
  specs,
  analytics,
}: {
  specs: ReportChartSpec[];
  analytics: DashboardInsights;
}) {
  if (specs.length === 0) return null;
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {specs.map((spec) => (
        <ReportChartBlock key={spec.id} spec={spec} analytics={analytics} />
      ))}
    </div>
  );
}
