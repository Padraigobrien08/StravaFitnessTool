"use client";

import { Eyebrow, Panel } from "@/components/console/console-kit";
import { PredictionTrendChart } from "@/components/progression/prediction-trend-chart";
import type { PredictionTimelinePoint } from "@/lib/analytics/progression";
import type { RaceDistance } from "@/lib/analytics/readiness";
import type { PredictionTrendSeriesKey } from "@/components/progression/prediction-trend-chart";

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
      <Panel>
        <Eyebrow className="mb-2.5">Trajectory & forecasting</Eyebrow>
        <p className="text-sm text-zinc-500">
          Need more history: predictions are sampled every four weeks once enough training exists.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <Eyebrow className="mb-2.5">Trajectory & forecasting</Eyebrow>
      {narrative ? (
        <p className="mb-4 text-xs leading-snug text-zinc-500">{narrative}</p>
      ) : (
        <p className="mb-4 text-xs leading-snug text-zinc-500">
          {goalDistance === "marathon"
            ? "Half marathon consensus trend shown as the closest distance in your history. Y-axis scaled to visible range."
            : "How consensus race projections evolved for your goal distance. Y-axis uses min–max of plotted points (outliers trimmed)."}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg bg-[var(--surface-subdued)] px-2 py-3 ring-1 ring-inset ring-[var(--border-subtle)]">
        <PredictionTrendChart
          timeline={timeline}
          seriesKeys={goalDistance ? GOAL_SERIES[goalDistance] : undefined}
        />
      </div>
    </Panel>
  );
}
