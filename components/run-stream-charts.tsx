"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { formatPace } from "@/lib/utils";
import { useTrainingChart } from "@/components/training/charts/chart-theme";

const chartTick = { fontSize: 10, fill: "var(--chart-tick-fill)" };

export function RunStreamCharts({ fit }: { fit: FitRunDetail }) {
  const chart = useTrainingChart();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {fit.hrStream.length > 2 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">Heart rate</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fit.hrStream}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="elapsedSec"
                tick={chartTick}
                tickFormatter={(s) => `${Math.round(s / 60)}m`}
              />
              <YAxis tick={chartTick} domain={["auto", "auto"]} />
              <Tooltip contentStyle={chart.tooltip} />
              <Line type="monotone" dataKey="hr" stroke="#f87171" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {fit.paceStream.length > 2 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">Pace</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fit.paceStream}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="elapsedSec"
                tick={chartTick}
                tickFormatter={(s) => `${Math.round(s / 60)}m`}
              />
              <YAxis
                tick={chartTick}
                reversed
                tickFormatter={(v) => formatPace(v)}
              />
              <Tooltip
                contentStyle={chart.tooltip}
                formatter={(v) => [
                  typeof v === "number" ? formatPace(v) : "—",
                  "Pace",
                ]}
              />
              <Line
                type="monotone"
                dataKey="paceSecPerKm"
                stroke="#34d399"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
