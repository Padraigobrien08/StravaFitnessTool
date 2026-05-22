"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { RaceReadiness } from "@/lib/analytics/readiness";
import { formatDuration } from "@/lib/utils";
import type { InsightConfidence } from "@/lib/insights/types";

export function RaceReadinessCard({
  readiness,
  confidence = "medium",
}: {
  readiness: RaceReadiness;
  confidence?: InsightConfidence;
}) {
  return (
    <Card className="border-emerald-500/20 lg:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{readiness.distanceLabel} readiness</CardTitle>
        <ConfidenceBadge level={confidence} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="font-display text-5xl font-bold text-emerald-400 tabular-nums">
              {readiness.score}
              <span className="text-lg text-zinc-500"> / 100</span>
            </p>
            <p className="mt-1 text-zinc-400">{readiness.label}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {readiness.probabilityBand}
            </p>
          </div>
          <div className="text-sm text-zinc-400">
            <p>
              <span className="text-zinc-500">Race day: </span>
              {new Date(readiness.raceDate).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <p className="mt-1 tabular-nums">
              <span className="text-zinc-500">Countdown: </span>
              {readiness.daysUntilRace === 0
                ? "Today"
                : `${readiness.daysUntilRace} day${readiness.daysUntilRace === 1 ? "" : "s"}`}
            </p>
            {readiness.targetTimeSec && (
              <p className="mt-1">
                <span className="text-zinc-500">Target: </span>
                {formatDuration(readiness.targetTimeSec)}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="text-zinc-500">Longest run</p>
            <p className="text-zinc-200">
              {readiness.longestRunKm} km ({readiness.longestRunPct}% of target)
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="text-zinc-500">4-week volume</p>
            <p className="text-zinc-200">
              {readiness.fourWeekVolumeKm} km ({readiness.volumePct}% of target)
            </p>
          </div>
        </div>

        {readiness.gaps.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Gaps to close
            </p>
            <ul className="mt-2 space-y-2">
              {readiness.gaps.map((g) => (
                <li
                  key={g.metric}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/5 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-300">{g.metric}</span>
                  <span className="text-zinc-500">
                    {g.current} → {g.target}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-emerald-400/90">
            No major gaps — keep tapering and staying healthy before race day.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
