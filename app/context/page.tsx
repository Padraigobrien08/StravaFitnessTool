"use client";

import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { Eyebrow, Panel } from "@/components/console/console-kit";

export default function ContextPage() {
  const { insights, importData } = useStrava();

  return (
    <RequireData>
      {insights && importData && (
        <div className="mx-auto w-full max-w-4xl space-y-3 pb-6 font-sans">
          <div className="border-b border-[var(--border-subtle)] pb-3">
            <Eyebrow>Activity context</Eyebrow>
            <h1 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
              Activity mix
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              How running fits among all {importData.allActivities.length} activities in your
              export.
            </p>
          </div>

          <Panel>
            <Eyebrow className="mb-3">Activity mix</Eyebrow>
            <div className="space-y-3">
              {insights.activityMix.slice(0, 8).map((a) => (
                <div key={a.type}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-zinc-300">{a.type}</span>
                    <span className="font-mono tabular-nums text-zinc-500">
                      {a.count} ({a.pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-subdued)] ring-1 ring-[var(--border-subtle)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${a.pct}%`, background: "var(--home-signal)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <Eyebrow className="mb-3">Monthly run volume</Eyebrow>
            <ul className="divide-y divide-[var(--border-subtle)] text-sm">
              {insights.monthlyVolume.map((m) => (
                <li key={m.month} className="flex justify-between py-2 text-zinc-400">
                  <span>{m.label}</span>
                  <span className="font-mono tabular-nums text-zinc-200">
                    {m.distanceKm.toFixed(1)} km · {m.runCount} runs
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </RequireData>
  );
}
