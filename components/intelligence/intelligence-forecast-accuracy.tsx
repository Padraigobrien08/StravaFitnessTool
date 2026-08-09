"use client";

import type { ForecastCalibrationResult } from "@/lib/forecasting-v2/calibrationService";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

export function IntelligenceForecastAccuracy({ data }: { data: ForecastCalibrationResult }) {
  const { summary } = data;
  if (summary.logged === 0) return null;

  const scored = data.forecasts.filter((f) => f.actualTimeSec != null);
  const bias =
    summary.medianSignedErrorSec == null
      ? null
      : summary.medianSignedErrorSec > 5
        ? `optimistic (~${summary.medianSignedErrorSec}s fast)`
        : summary.medianSignedErrorSec < -5
          ? `conservative (~${Math.abs(summary.medianSignedErrorSec)}s slow)`
          : "well-centered";

  return (
    <Panel title="Forecast accuracy" hint="how well predictions have held up">
      {summary.evaluated === 0 ? (
        <p className="mt-1 text-[12px] text-zinc-500">
          {summary.logged} forecast{summary.logged === 1 ? "" : "s"} logged, graded once you race
          that distance again.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[12px] text-zinc-400">
            <span className="font-medium text-zinc-200">{summary.outerBandHitRatePct}%</span> landed
            in the predicted range <span className="text-zinc-600">(well-calibrated ≈ 80%)</span> ·
            mean error {summary.meanAbsErrorSec}s
            {bias ? (
              <>
                {" "}
                · <span className="text-zinc-500">{bias}</span>
              </>
            ) : null}
          </p>
          <ul className="mt-2 space-y-1">
            {scored.slice(0, 5).map((f) => (
              <li
                key={f.forecastId}
                className="flex items-baseline gap-2 text-[12px] leading-snug tabular-nums"
              >
                <span className="w-[70px] shrink-0 text-zinc-600">{f.issuedAt.slice(0, 10)}</span>
                <span className="w-10 shrink-0 text-zinc-500">{f.distanceKey}</span>
                <span className="text-zinc-400">
                  predicted {formatDuration(f.mostLikelyTimeSec)} → ran{" "}
                  {f.actualTimeSec != null ? formatDuration(f.actualTimeSec) : "—"}
                </span>
                <span
                  className={cn(
                    "text-[11px]",
                    f.withinBand ? "text-[var(--home-good)]" : "text-amber-400/85",
                  )}
                >
                  {f.withinBand ? "in range" : "off"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
