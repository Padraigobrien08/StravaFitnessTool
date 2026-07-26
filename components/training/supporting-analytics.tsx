"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTrainingChart } from "./charts/chart-theme";
import { useUnitFormat } from "@/hooks/use-unit-format";
import type { SupportingAnalyticsView } from "@/lib/training/viewModels";
import { Eyebrow, Panel } from "@/components/console/console-kit";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function SupportingAnalytics({
  data,
  defaultCollapsed = false,
}: {
  data: SupportingAnalyticsView;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const chart = useTrainingChart();
  const { distanceLabel } = useUnitFormat();

  return (
    <Panel>
      <Eyebrow className="mb-3">Supporting analytics</Eyebrow>
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
          <p className="mb-4 text-xs text-zinc-600">
            Elevation cost and block history — evidence behind the coaching view, not the primary
            decision layer.
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
                <div className="overflow-x-auto">
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={data.elevationChart}>
                      <CartesianGrid stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="label" tick={chart.tick} axisLine={false} tickLine={false} />
                      <YAxis tick={chart.tick} width={28} axisLine={false} tickLine={false} />
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
                </div>
              </>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="4-week training blocks"
            summary={data.bestBlock ?? "Rolling block history"}
            defaultOpen={!!data.bestBlock}
          >
            {data.bestBlock ? (
              <p className="mb-3 text-xs text-accent/85">Best block: {data.bestBlock}</p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-zinc-600">
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
                        "border-b border-[var(--border-subtle)] text-zinc-400",
                        b.highlight && "bg-accent/[0.06] text-zinc-300",
                      )}
                    >
                      <td className="py-2">{b.label}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {b.distanceKm} {distanceLabel}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">{b.runCount}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {b.longestRunKm} {distanceLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </>
      ) : null}
    </Panel>
  );
}
