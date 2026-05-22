"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { RacePredictionAnalysis } from "@/lib/analytics/predictions";

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fafafa",
};

const MODEL_COLORS: Record<string, string> = {
  riegel: "#34d399",
  cameron: "#818cf8",
  regression: "#fbbf24",
  multi: "#f472b6",
};

export function PredictionChart({
  analysis,
}: {
  analysis: RacePredictionAnalysis;
}) {
  const effortScatter = analysis.efforts.map((e) => ({
    distanceKm: e.distanceKm,
    timeMin: e.timeSec / 60,
    name: e.runName,
    source: e.source,
  }));

  const riegel = analysis.models.find((m) => m.id === "riegel");
  const cameron = analysis.models.find((m) => m.id === "cameron");
  const reg = analysis.regression;

  const distances = reg?.curve.map((c) => c.distanceKm) ?? 
    Array.from({ length: 82 }, (_, i) => 3 + i * 0.5);
  const merged = distances.map((d) => {
    const row: Record<string, number> = { distanceKm: d };
    if (riegel && analysis.primaryAnchor) {
      const a = analysis.primaryAnchor;
      row.riegel =
        (predictRiegel(a.distanceKm * 1000, a.timeSec, d * 1000) / 60);
    }
    if (cameron && analysis.primaryAnchor) {
      const a = analysis.primaryAnchor;
      row.cameron =
        (predictCameron(a.distanceKm * 1000, a.timeSec, d * 1000) / 60);
    }
    if (reg) {
      row.regression = (reg.coefficient * Math.pow(d, reg.exponent)) / 60;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          type="number"
          dataKey="distanceKm"
          domain={[2, 44]}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          label={{
            value: "Distance (km)",
            position: "insideBottom",
            offset: -4,
            fill: "#71717a",
            fontSize: 11,
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          label={{
            value: "Time (min)",
            angle: -90,
            position: "insideLeft",
            fill: "#71717a",
            fontSize: 11,
          }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => {
            const n = typeof v === "number" ? v : Number(v);
            if (!Number.isFinite(n)) return ["—", ""];
            return [
              `${Math.floor(n)}:${String(Math.round((n % 1) * 60)).padStart(2, "0")} (min)`,
              "",
            ];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Scatter
          name="Your efforts"
          data={effortScatter}
          dataKey="timeMin"
          fill="#10b981"
        />
        {riegel && (
          <Line
            data={merged}
            type="monotone"
            dataKey="riegel"
            stroke={MODEL_COLORS.riegel}
            dot={false}
            strokeWidth={2}
            name="Riegel"
          />
        )}
        {cameron && (
          <Line
            data={merged}
            type="monotone"
            dataKey="cameron"
            stroke={MODEL_COLORS.cameron}
            dot={false}
            strokeWidth={2}
            strokeDasharray="6 4"
            name="Cameron"
          />
        )}
        {reg && (
          <Line
            data={merged}
            type="monotone"
            dataKey="regression"
            stroke={MODEL_COLORS.regression}
            dot={false}
            strokeWidth={2}
            name="Your curve"
          />
        )}
        {[5, 10, 21.0975, 42.195].map((d) => (
          <ReferenceLine
            key={d}
            x={d}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="2 4"
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function predictRiegel(d1: number, t1: number, d2: number) {
  return t1 * Math.pow(d2 / d1, 1.06);
}

function predictCameron(d1: number, t1: number, d2: number) {
  return t1 * (d2 / d1) * (2 - d1 / d2);
}
