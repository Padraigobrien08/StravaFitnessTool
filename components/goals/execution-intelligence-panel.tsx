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
import { Eyebrow, Panel } from "@/components/console/console-kit";
import { useTrainingChart } from "@/components/training/charts/chart-theme";
import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import { simulateRaceStrategy, type StrategyMode } from "@/lib/analytics/raceStrategy";
import { minMaxYDomainReversed } from "@/lib/charts/yDomain";
import { formatDuration, formatPace, cn } from "@/lib/utils";

const MODES: { id: StrategyMode; label: string; desc: string }[] = [
  { id: "even", label: "Even split", desc: "Steady effort, slight second-half drift" },
  { id: "negative", label: "Negative split", desc: "Controlled first half, faster finish" },
  { id: "conservative", label: "Conservative", desc: "Easier start, limit late fade" },
  { id: "aggressive", label: "Aggressive", desc: "Faster early, higher fade risk" },
];

const fadeColor = {
  low: "text-accent",
  medium: "text-amber-400",
  high: "text-red-400",
};

export function ExecutionIntelligencePanel({
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
      <Panel>
        <Eyebrow className="mb-2.5">Execution intelligence</Eyebrow>
        <p className="text-sm text-zinc-500">
          Set a target time or ensure predictions exist for this distance.
        </p>
      </Panel>
    );
  }

  const chartData = strategy.splits.map((s) => ({
    km: s.km,
    pace: s.paceSecPerKm,
  }));

  const paceDomain = minMaxYDomainReversed(
    chartData.map((d) => d.pace),
    { paddingPct: 0.12, paddingMin: 8, filterOutliers: false },
  );

  const formatPaceTick = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <Panel>
      <Eyebrow className="mb-2.5">Execution intelligence</Eyebrow>
      <p className="mb-4 text-xs text-zinc-500">
        Target{" "}
        <span className="font-mono tabular-nums text-zinc-300">
          {formatDuration(strategy.targetTimeSec)}
        </span>{" "}
        ({strategy.targetTimeSource}) · Fade risk{" "}
        <span className={fadeColor[strategy.fadeRisk]}>{strategy.fadeRisk}</span>
      </p>

      <div
        className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        role="group"
        aria-label="Pacing strategy"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            // Selection was signalled by background colour alone, so assistive
            // tech could not tell which strategy was active.
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
              mode === m.id
                ? "bg-accent/10 ring-accent/35"
                : "bg-[var(--surface-subdued)] ring-[var(--border-subtle)] hover:bg-[var(--surface-hover)]",
            )}
          >
            <span className="text-xs font-semibold text-zinc-200">{m.label}</span>
            <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{m.desc}</p>
          </button>
        ))}
      </div>

      <ul className="mb-4 space-y-1 text-xs text-zinc-500">
        {strategy.narrative.map((n, i) => (
          <li key={i}>· {n}</li>
        ))}
        <li className="text-zinc-500">· {activeMode.desc}</li>
      </ul>

      <div className="rounded-lg bg-[var(--surface-subdued)] p-2 ring-1 ring-inset ring-[var(--border-subtle)]">
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Pacing progression
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis dataKey="km" tick={chart.tick} unit=" km" axisLine={false} tickLine={false} />
            <YAxis
              domain={paceDomain}
              allowDataOverflow
              tick={chart.tick}
              reversed
              tickFormatter={formatPaceTick}
              axisLine={false}
              tickLine={false}
            />
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
              stroke="var(--home-signal)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--home-signal)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-[var(--border-subtle)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-subdued)] text-[10px] uppercase tracking-wider text-zinc-500">
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
                className="border-b border-[var(--border-subtle)] font-mono tabular-nums text-zinc-400"
              >
                <td className="px-3 py-2">{s.km}</td>
                <td className="px-3 py-2 text-zinc-200">{formatDuration(s.cumulativeSec)}</td>
                <td className="px-3 py-2">{formatDuration(s.segmentSec)}</td>
                <td className="px-3 py-2 text-accent">{formatPace(s.paceSecPerKm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[var(--surface-subdued)] px-3 py-2.5 text-xs text-zinc-500 ring-1 ring-[var(--border-subtle)]">
          <p className="font-medium text-zinc-400">Physiological note</p>
          <p className="mt-1">{strategy.uncertaintyNote}</p>
        </div>
        <div className="rounded-lg bg-[var(--surface-subdued)] px-3 py-2.5 text-xs text-zinc-500 ring-1 ring-[var(--border-subtle)]">
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
    </Panel>
  );
}
