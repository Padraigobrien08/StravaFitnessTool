"use client";

import { useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatThisMeans } from "@/components/layout/what-this-means";
import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import { simulateRaceStrategy, type StrategyMode } from "@/lib/analytics/raceStrategy";
import { formatDuration, formatPace } from "@/lib/utils";
import { useTrainingChart } from "@/components/training/charts/chart-theme";

const chartTick = { fontSize: 10, fill: "var(--chart-tick-fill)" };

const MODES: { id: StrategyMode; label: string }[] = [
  { id: "even", label: "Even" },
  { id: "negative", label: "Negative split" },
  { id: "conservative", label: "Conservative" },
];

const fadeColor = {
  low: "text-teal-400",
  medium: "text-amber-400",
  high: "text-red-400",
};

export function RaceStrategyPanel({
  raceGoal,
  analytics,
}: {
  raceGoal: RaceGoal;
  analytics: DashboardInsights;
}) {
  const [mode, setMode] = useState<StrategyMode>("even");
  const chart = useTrainingChart();

  const strategy = useMemo(
    () =>
      simulateRaceStrategy(
        raceGoal,
        analytics.racePredictionAnalysis,
        analytics.fatigue,
        analytics.raceReadiness,
        mode,
      ),
    [raceGoal, analytics, mode],
  );

  if (!strategy) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">
          Set a target time or ensure predictions are available for this distance.
        </CardContent>
      </Card>
    );
  }

  const chartData = strategy.splits.map((s) => ({
    km: s.km,
    pace: s.paceSecPerKm,
    cumulativeMin: s.cumulativeSec / 60,
  }));

  const formatPaceTick = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="border-indigo-500/20">
      <CardHeader>
        <CardTitle>Race day strategy</CardTitle>
        <p className="text-sm text-zinc-500">
          Target {formatDuration(strategy.targetTimeSec)} ({strategy.targetTimeSource}) · Fade risk:{" "}
          <span className={fadeColor[strategy.fadeRisk]}>{strategy.fadeRisk}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                mode === m.id
                  ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                  : "border-white/10 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <ul className="space-y-1 text-sm text-zinc-400">
          {strategy.narrative.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-zinc-500">
                <th className="pb-3 pr-4">At (km)</th>
                <th className="pb-3 pr-4">Cumulative</th>
                <th className="pb-3 pr-4">Segment</th>
                <th className="pb-3">Pace</th>
              </tr>
            </thead>
            <tbody>
              {strategy.splits.map((s) => (
                <tr key={s.km} className="border-b border-white/5 text-zinc-300">
                  <td className="py-2 pr-4 tabular-nums">{s.km}</td>
                  <td className="py-2 pr-4 tabular-nums text-white">
                    {formatDuration(s.cumulativeSec)}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-zinc-500">
                    {formatDuration(s.segmentSec)}
                  </td>
                  <td className="py-2 tabular-nums text-teal-400/90">
                    {formatPace(s.paceSecPerKm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p className="mb-2 text-xs text-zinc-500">Pace profile by segment</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="km" tick={chartTick} unit=" km" />
              <YAxis tick={chartTick} reversed tickFormatter={formatPaceTick} />
              <Tooltip
                contentStyle={chart.tooltip}
                formatter={(v) => (typeof v === "number" ? formatPace(v) : String(v))}
              />
              <ReferenceLine
                y={strategy.targetTimeSec / strategy.distanceKm}
                stroke="var(--chart-ref-line)"
                strokeDasharray="4 4"
              />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#818cf8"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Pace"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-white/[0.02] px-3 py-2 text-sm text-zinc-500">
          <p className="font-medium text-zinc-400">Fade risk factors</p>
          <ul className="mt-2 space-y-1">
            {strategy.fadeFactors.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>

        {strategy.warnings.length > 0 && (
          <ul className="space-y-1 text-sm text-amber-400/90">
            {strategy.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        )}

        <WhatThisMeans>
          {strategy.uncertaintyNote} Splits are scaled to match your target time exactly; adjust if
          conditions or how you feel on the day differ.
        </WhatThisMeans>
      </CardContent>
    </Card>
  );
}
