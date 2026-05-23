"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OverlaySegment, TimelinePoint } from "@/lib/route-intelligence/types";
import { formatPace } from "@/lib/utils";
import { formatReplayClock } from "@/lib/route-intelligence/replay";
import { dash } from "@/components/home/primitives/tokens";
import { useTrainingChart } from "@/components/training/charts/chart-theme";

const chartTick = { fontSize: 9, fill: "var(--chart-tick-fill)" };

const OVERLAY_FILL: Record<string, string> = {
  interval: "rgba(45,212,191,0.12)",
  recovery: "rgba(82,82,91,0.08)",
  fade: "rgba(245,158,11,0.12)",
  pause: "rgba(113,113,122,0.1)",
  pace_spike: "rgba(167,139,250,0.1)",
  climb: "rgba(52,211,153,0.1)",
  descent: "rgba(96,165,250,0.1)",
};

function toChartData(timeline: TimelinePoint[]) {
  return timeline.map((p) => ({
    t: p.elapsedSec,
    pace: p.paceSecPerKm,
    hr: p.hr,
    ele: p.elevationM,
  }));
}

function SyncChart({
  data,
  currentSec,
  overlays,
  children,
  yDomain,
  height = 100,
}: {
  data: ReturnType<typeof toChartData>;
  currentSec: number;
  overlays: OverlaySegment[];
  children: React.ReactNode;
  yDomain?: [number | string, number | string];
  height?: number;
}) {
  const chart = useTrainingChart();

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          onClick={(e) => {
            if (e?.activeLabel != null) {
              const t = Number(e.activeLabel);
              if (!Number.isNaN(t)) {
                window.dispatchEvent(
                  new CustomEvent("route-scrub", { detail: t })
                );
              }
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={chartTick}
            tickFormatter={(v) => formatReplayClock(v)}
            hide
          />
          <YAxis domain={yDomain} tick={chartTick} width={36} />
          <Tooltip
            contentStyle={chart.tooltip}
            labelFormatter={(v) => formatReplayClock(Number(v))}
          />
          {overlays.map((o) => (
            <ReferenceArea
              key={o.id}
              x1={o.startSec}
              x2={o.endSec}
              fill={OVERLAY_FILL[o.kind] ?? "rgba(255,255,255,0.03)"}
              strokeOpacity={0}
            />
          ))}
          <ReferenceLine
            x={currentSec}
            stroke="#5eead4"
            strokeWidth={2}
            strokeOpacity={0.9}
          />
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RouteTelemetryPanel({
  timeline,
  currentSec,
  overlays,
  hasPace,
  hasHr,
  hasElevation,
}: {
  timeline: TimelinePoint[];
  currentSec: number;
  overlays: OverlaySegment[];
  hasPace: boolean;
  hasHr: boolean;
  hasElevation: boolean;
}) {
  const data = toChartData(timeline);

  return (
    <div className="space-y-3 border-t border-white/[0.06] bg-[#0a0b0e]/80 px-4 py-3">
      {hasPace ? (
        <div>
          <p className={dash.label}>Pace</p>
          <SyncChart
            data={data}
            currentSec={currentSec}
            overlays={overlays}
            yDomain={["auto", "auto"]}
          >
            <Line
              type="monotone"
              dataKey="pace"
              stroke="#5eead4"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </SyncChart>
        </div>
      ) : null}

      {hasHr ? (
        <div>
          <p className={dash.label}>Heart rate</p>
          <SyncChart
            data={data}
            currentSec={currentSec}
            overlays={overlays}
            yDomain={["dataMin", "dataMax"]}
          >
            <Area
              type="monotone"
              dataKey="hr"
              stroke="#f87171"
              fill="rgba(248,113,113,0.15)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </SyncChart>
        </div>
      ) : null}

      {hasElevation ? (
        <div>
          <p className={dash.label}>Elevation</p>
          <SyncChart
            data={data}
            currentSec={currentSec}
            overlays={overlays}
            yDomain={["dataMin", "dataMax"]}
          >
            <Area
              type="monotone"
              dataKey="ele"
              stroke="#94a3b8"
              fill="rgba(148,163,184,0.12)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </SyncChart>
        </div>
      ) : null}

      <Scrubber
        duration={timeline[timeline.length - 1]?.elapsedSec ?? 0}
        currentSec={currentSec}
      />
    </div>
  );
}

function Scrubber({
  duration,
  currentSec,
}: {
  duration: number;
  currentSec: number;
}) {
  return (
    <div className="pt-1">
      <input
        type="range"
        min={0}
        max={duration}
        step={0.5}
        value={currentSec}
        onChange={(e) => {
          window.dispatchEvent(
            new CustomEvent("route-scrub", {
              detail: Number(e.target.value),
            })
          );
        }}
        className="route-scrubber w-full"
      />
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-600">
        <span>{formatReplayClock(0)}</span>
        <span className="text-teal-400/80">{formatReplayClock(currentSec)}</span>
        <span>{formatReplayClock(duration)}</span>
      </div>
    </div>
  );
}

export function paceTooltipFormatter(pace: number) {
  return formatPace(pace);
}
