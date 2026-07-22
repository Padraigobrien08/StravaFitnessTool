"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { PredictionTrendChart } from "@/components/progression/prediction-trend-chart";
import type { PredictionTimelinePoint } from "@/lib/analytics/progression";
import type { RaceDistance } from "@/lib/analytics/readiness";
import type { PredictionTrendSeriesKey } from "@/components/progression/prediction-trend-chart";
import { dash } from "@/components/home/primitives/tokens";

const GOAL_SERIES: Record<RaceDistance, PredictionTrendSeriesKey[]> = {
  "5k": ["5K"],
  "10k": ["10K"],
  hm: ["HM"],
  marathon: ["HM"],
};

export function TrajectoryForecastPanel({
  timeline,
  narrative,
  goalDistance,
}: {
  timeline: PredictionTimelinePoint[];
  narrative: string | null;
  goalDistance?: RaceDistance | null;
}) {
  if (timeline.length < 2) {
    return (
      <PanelChrome title="Trajectory & forecasting" subdued>
        <p className="text-sm text-zinc-500">
          Need more history — predictions are sampled every four weeks once enough training exists.
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
          {goalDistance === "marathon"
            ? "Half marathon consensus trend shown as the closest distance in your history — Y-axis scaled to visible range."
            : "How consensus race projections evolved for your goal distance — Y-axis uses min–max of plotted points (outliers trimmed)."}
        </p>
      )}
      <div className="rounded-lg bg-white/[0.02] px-2 py-3 ring-1 ring-inset ring-white/[0.04]">
        <PredictionTrendChart
          timeline={timeline}
          seriesKeys={goalDistance ? GOAL_SERIES[goalDistance] : undefined}
        />
      </div>
    </PanelChrome>
  );
}
