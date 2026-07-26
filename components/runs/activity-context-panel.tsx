"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ActivityMixRow = { type: string; count: number; pct: number };
type MonthlyVolumeRow = { month: string; label: string; distanceKm: number; runCount: number };

/**
 * Activity mix + monthly volume — how running fits among every activity in the
 * export. Lives as the "Activity mix" view inside Activities (was /context).
 */
export function ActivityContextPanel({
  activityMix,
  monthlyVolume,
  totalActivities,
}: {
  activityMix: ActivityMixRow[];
  monthlyVolume: MonthlyVolumeRow[];
  totalActivities: number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-zinc-600">
        How running fits among all {totalActivities} activities in your export.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Activity mix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activityMix.slice(0, 8).map((a) => (
              <div key={a.type}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-zinc-300">{a.type}</span>
                  <span className="text-zinc-500">
                    {a.count} ({a.pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-teal-500/80"
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly run volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {monthlyVolume.map((m) => (
              <li
                key={m.month}
                className="flex justify-between border-b border-white/5 py-2 text-zinc-400"
              >
                <span>{m.label}</span>
                <span className="text-zinc-200">
                  {m.distanceKm.toFixed(1)} km · {m.runCount} runs
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
