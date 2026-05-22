"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { trainingChart } from "@/components/training/charts/chart-theme";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { StreamAnnotationView } from "@/lib/runs/workoutDetailViewModels";
import { formatPace, cn } from "@/lib/utils";
import { dash } from "@/components/home/primitives/tokens";

export function StreamIntelligencePanel({
  fit,
  annotations,
  loading,
  error,
}: {
  fit: FitRunDetail | null;
  annotations: StreamAnnotationView[];
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return (
      <PanelChrome title="Stream intelligence" subdued>
        <p className="text-sm text-zinc-500">Loading HR, pace, and lap streams…</p>
      </PanelChrome>
    );
  }

  if (error) {
    return (
      <PanelChrome title="Stream intelligence" subdued>
        <p className="text-sm text-amber-400/90">{error}</p>
      </PanelChrome>
    );
  }

  if (
    !fit ||
    (fit.hrStream.length < 3 && fit.paceStream.length < 3)
  ) {
    return (
      <PanelChrome title="Stream intelligence" subdued>
        <p className="text-sm text-zinc-500">
          No stream data — sync from Strava or re-import FIT for telemetry
          interpretation.
        </p>
      </PanelChrome>
    );
  }

  const midElapsed =
    fit.paceStream.length > 0
      ? fit.paceStream[Math.floor(fit.paceStream.length / 2)]?.elapsedSec
      : fit.hrStream[Math.floor(fit.hrStream.length / 2)]?.elapsedSec;

  return (
    <PanelChrome title="Workout telemetry interpretation">
      <ul className="mb-4 space-y-1.5">
        {annotations.map((a, i) => (
          <li
            key={i}
            className="flex gap-2 text-xs leading-relaxed text-zinc-500"
          >
            <span
              className={
                a.kind === "hr"
                  ? "text-red-400/70"
                  : a.kind === "pace"
                    ? "text-teal-400/70"
                    : "text-zinc-600"
              }
            >
              ●
            </span>
            {a.text}
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        {fit.hrStream.length > 2 && (
          <div className="rounded-lg bg-white/[0.02] p-2 ring-1 ring-inset ring-white/[0.04]">
            <p className={cn(dash.label, "px-1 pb-2")}>Heart rate</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={fit.hrStream}>
                <CartesianGrid stroke={trainingChart.grid} vertical={false} />
                <XAxis
                  dataKey="elapsedSec"
                  tick={trainingChart.tick}
                  tickFormatter={(s) => `${Math.round(s / 60)}m`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={trainingChart.tick}
                  domain={["auto", "auto"]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={trainingChart.tooltip} />
                {midElapsed != null ? (
                  <ReferenceLine
                    x={midElapsed}
                    stroke="rgba(255,255,255,0.12)"
                    strokeDasharray="4 4"
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="#f87171"
                  strokeWidth={1.75}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {fit.paceStream.length > 2 && (
          <div className="rounded-lg bg-white/[0.02] p-2 ring-1 ring-inset ring-white/[0.04]">
            <p className={cn(dash.label, "px-1 pb-2")}>Pace</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={fit.paceStream}>
                <CartesianGrid stroke={trainingChart.grid} vertical={false} />
                <XAxis
                  dataKey="elapsedSec"
                  tick={trainingChart.tick}
                  tickFormatter={(s) => `${Math.round(s / 60)}m`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={trainingChart.tick}
                  reversed
                  tickFormatter={(v) => formatPace(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={trainingChart.tooltip}
                  formatter={(v) => [
                    typeof v === "number" ? formatPace(v) : "—",
                    "Pace",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="paceSecPerKm"
                  stroke={trainingChart.teal}
                  strokeWidth={1.75}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </PanelChrome>
  );
}
