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
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { trainingChart } from "@/components/training/charts/chart-theme";
import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import {
  simulateRaceStrategy,
  type StrategyMode,
} from "@/lib/analytics/raceStrategy";
import { formatDuration, formatPace, cn } from "@/lib/utils";
import { dash } from "@/components/home/primitives/tokens";

const MODES: { id: StrategyMode; label: string; desc: string }[] = [
  { id: "even", label: "Even split", desc: "Steady effort, slight second-half drift" },
  { id: "negative", label: "Negative split", desc: "Controlled first half, faster finish" },
  { id: "conservative", label: "Conservative", desc: "Easier start, limit late fade" },
  { id: "aggressive", label: "Aggressive", desc: "Faster early — higher fade risk" },
];

const fadeColor = {
  low: "text-teal-400",
  medium: "text-amber-400",
  high: "text-red-400",
};

const tooltipStyle = trainingChart.tooltip;

export function ExecutionIntelligencePanel({
  raceGoal,
  analytics,
}: {
  raceGoal: RaceGoal;
  analytics: DashboardInsights;
}) {
  const [mode, setMode] = useState<StrategyMode>("even");

  const strategy = useMemo(
    () =>
      simulateRaceStrategy(
        raceGoal,
        analytics.racePredictionAnalysis,
        analytics.fatigue,
        analytics.raceReadiness,
        mode
      ),
    [raceGoal, analytics, mode]
  );

  if (!strategy) {
    return (
      <PanelChrome title="Execution intelligence" subdued>
        <p className="text-sm text-zinc-500">
          Set a target time or ensure predictions exist for this distance.
        </p>
      </PanelChrome>
    );
  }

  const chartData = strategy.splits.map((s) => ({
    km: s.km,
    pace: s.paceSecPerKm,
  }));

  const formatPaceTick = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <PanelChrome title="Execution intelligence" elevated>
      <p className={`${dash.muted} mb-4`}>
        Target {formatDuration(strategy.targetTimeSec)} ({strategy.targetTimeSource})
        · Fade risk{" "}
        <span className={fadeColor[strategy.fadeRisk]}>{strategy.fadeRisk}</span>
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-colors",
              mode === m.id
                ? "border-teal-500/35 bg-teal-500/10"
                : "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]"
            )}
          >
            <span className="text-xs font-semibold text-zinc-200">{m.label}</span>
            <p className="mt-0.5 text-[10px] leading-snug text-zinc-600">{m.desc}</p>
          </button>
        ))}
      </div>

      <ul className="mb-4 space-y-1 text-xs text-zinc-500">
        {strategy.narrative.map((n, i) => (
          <li key={i}>· {n}</li>
        ))}
        <li className="text-zinc-600">· {activeMode.desc}</li>
      </ul>

      <div className="rounded-lg bg-white/[0.02] p-2 ring-1 ring-inset ring-white/[0.04]">
        <p className={cn(dash.label, "px-1 pb-2")}>Pacing progression</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid stroke={trainingChart.grid} vertical={false} />
            <XAxis
              dataKey="km"
              tick={trainingChart.tick}
              unit=" km"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={trainingChart.tick}
              reversed
              tickFormatter={formatPaceTick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) =>
                typeof v === "number" ? formatPace(v) : String(v)
              }
            />
            <ReferenceLine
              y={strategy.targetTimeSec / strategy.distanceKm}
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="pace"
              stroke={trainingChart.teal}
              strokeWidth={2}
              dot={{ r: 3, fill: trainingChart.teal }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.05]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 text-left">Km</th>
              <th className="px-3 py-2 text-left">Cumulative</th>
              <th className="px-3 py-2 text-left">Segment</th>
              <th className="px-3 py-2 text-left">Pace</th>
            </tr>
          </thead>
          <tbody>
            {strategy.splits.map((s) => (
              <tr
                key={s.km}
                className="border-b border-white/[0.03] text-zinc-400"
              >
                <td className="px-3 py-2 tabular-nums">{s.km}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-200">
                  {formatDuration(s.cumulativeSec)}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatDuration(s.segmentSec)}</td>
                <td className="px-3 py-2 tabular-nums text-teal-300/90">
                  {formatPace(s.paceSecPerKm)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-500">
          <p className="font-medium text-zinc-400">Physiological note</p>
          <p className="mt-1">{strategy.uncertaintyNote}</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-500">
          <p className="font-medium text-zinc-400">Fade factors</p>
          <ul className="mt-1 space-y-0.5">
            {strategy.fadeFactors.map((f, i) => (
              <li key={i}>· {f}</li>
            ))}
          </ul>
        </div>
      </div>

      {strategy.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-amber-400/90">
          {strategy.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </PanelChrome>
  );
}
