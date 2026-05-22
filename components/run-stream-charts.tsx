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

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fafafa",
};

export function RunStreamCharts({ fit }: { fit: FitRunDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {fit.hrStream.length > 2 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">Heart rate</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fit.hrStream}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="elapsedSec"
                tick={{ fontSize: 10, fill: "#a1a1aa" }}
                tickFormatter={(s) => `${Math.round(s / 60)}m`}
              />
              <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="elapsedSec"
                tick={{ fontSize: 10, fill: "#a1a1aa" }}
                tickFormatter={(s) => `${Math.round(s / 60)}m`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#a1a1aa" }}
                reversed
                tickFormatter={(v) => formatPace(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
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
