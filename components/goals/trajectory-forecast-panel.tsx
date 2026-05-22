"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { PredictionTrendChart } from "@/components/progression/prediction-trend-chart";
import type { PredictionTimelinePoint } from "@/lib/analytics/progression";
import { dash } from "@/components/home/primitives/tokens";

export function TrajectoryForecastPanel({
  timeline,
  narrative,
}: {
  timeline: PredictionTimelinePoint[];
  narrative: string | null;
}) {
  if (timeline.length < 2) {
    return (
      <PanelChrome title="Trajectory & forecasting" subdued>
        <p className="text-sm text-zinc-500">
          Need more history — predictions are sampled every four weeks once
          enough training exists.
        </p>
      </PanelChrome>
    );
  }

  return (
    <PanelChrome title="Trajectory & forecasting" accent>
      {narrative ? (
        <p className={`${dash.muted} mb-4`}>{narrative}</p>
      ) : (
        <p className={`${dash.muted} mb-4`}>
          How consensus race projections evolved — use direction of travel, not
          single-week noise.
        </p>
      )}
      <div className="rounded-lg bg-white/[0.02] px-2 py-3 ring-1 ring-inset ring-white/[0.04]">
        <PredictionTrendChart timeline={timeline} />
      </div>
    </PanelChrome>
  );
}
