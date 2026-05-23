"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { useTrainingChart } from "./charts/chart-theme";
import type { SupportingAnalyticsView } from "@/lib/training/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

function CollapsibleSection({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-white/[0.04] pt-4 first:border-0 first:pt-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <p className="text-xs font-semibold text-zinc-400">{title}</p>
          {summary && !open ? (
            <p className="mt-0.5 text-[11px] text-zinc-600">{summary}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-600 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function SupportingAnalytics({
  data,
  defaultCollapsed = false,
}: {
  data: SupportingAnalyticsView;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const chart = useTrainingChart();

  return (
    <PanelChrome title="Supporting analytics" subdued>
      {defaultCollapsed ? (
        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between text-left text-xs text-zinc-500"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span>Raw charts & block tables (advanced)</span>
          <ChevronDown className={cn("h-4 w-4", open && "rotate-180")} />
        </button>
      ) : null}
      {!defaultCollapsed || open ? (
      <>
      <p className={cn(dash.muted, "mb-4")}>
        Elevation cost and block history — evidence behind the coaching view, not
        the primary decision layer.
      </p>

      <CollapsibleSection
        title="Elevation per km"
        summary={data.elevationAvg ?? "No elevation data"}
      >
        {data.elevationChart.length === 0 ? (
          <p className="text-xs text-zinc-600">No elevation data in export.</p>
        ) : (
          <>
            {data.elevationAvg ? (
              <p className="mb-2 text-xs text-zinc-500">{data.elevationAvg}</p>
            ) : null}
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={data.elevationChart}>
                <CartesianGrid stroke={chart.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={chart.tick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={chart.tick}
                  width={28}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={chart.tooltip} />
                <Bar
                  dataKey="gainPerKm"
                  fill={chart.amber}
                  fillOpacity={0.65}
                  radius={[3, 3, 0, 0]}
                  name="m/km"
                />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="4-week training blocks"
        summary={data.bestBlock ?? "Rolling block history"}
        defaultOpen={!!data.bestBlock}
      >
        {data.bestBlock ? (
          <p className="mb-3 text-xs text-teal-400/85">Best block: {data.bestBlock}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-600">
                <th className="pb-2 text-left font-medium">Period</th>
                <th className="pb-2 text-right font-medium">Volume</th>
                <th className="pb-2 text-right font-medium">Runs</th>
                <th className="pb-2 text-right font-medium">Longest</th>
              </tr>
            </thead>
            <tbody>
              {data.blocks.map((b) => (
                <tr
                  key={b.label}
                  className={cn(
                    "border-b border-white/[0.03] text-zinc-400",
                    b.highlight && "bg-teal-500/[0.04] text-zinc-300"
                  )}
                >
                  <td className="py-2">{b.label}</td>
                  <td className="py-2 text-right tabular-nums">
                    {b.distanceKm} km
                  </td>
                  <td className="py-2 text-right tabular-nums">{b.runCount}</td>
                  <td className="py-2 text-right tabular-nums">
                    {b.longestRunKm} km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
      </>
      ) : null}
    </PanelChrome>
  );
}
