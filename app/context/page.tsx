"use client";

import { RequireData } from "@/components/require-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrava } from "@/lib/context/strava-context";

export default function ContextPage() {
  const { insights, importData } = useStrava();

  return (
    <RequireData>
      {insights && importData && (
        <div className="space-y-8">
          <h1 className="font-display text-2xl font-bold text-white">Activity mix</h1>
          <p className="text-sm text-zinc-500">
            How running fits among all {importData.allActivities.length} activities in your export.
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Activity mix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.activityMix.slice(0, 8).map((a) => (
                  <div key={a.type}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-zinc-300">{a.type}</span>
                      <span className="text-zinc-500">
                        {a.count} ({a.pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-500/80"
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
                {insights.monthlyVolume.map((m) => (
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
      )}
    </RequireData>
  );
}
