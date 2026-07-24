"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatThisMeans } from "@/components/layout/what-this-means";
import { FatigueChart } from "@/components/charts";
import type { FatigueSnapshot } from "@/lib/analytics/fatigue";
import type { AcuteChronicLoad } from "@/lib/analytics/fatigue";

const labelColor: Record<string, string> = {
  Fresh: "text-teal-400",
  Neutral: "text-zinc-300",
  Fatigued: "text-amber-400",
};

export function FreshnessPanel({
  fatigue,
  loadHistory,
}: {
  fatigue: FatigueSnapshot;
  loadHistory: AcuteChronicLoad["history"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fatigue & freshness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs text-zinc-500">Freshness</p>
            <p className="font-display text-4xl font-bold tabular-nums text-white">
              {fatigue.freshness}
              <span className="text-lg text-zinc-500"> / 100</span>
            </p>
            <p
              className={`mt-1 text-sm font-medium ${labelColor[fatigue.label] ?? "text-zinc-400"}`}
            >
              {fatigue.label}
            </p>
          </div>
          <div className="text-sm text-zinc-400">
            <p>
              CTL {fatigue.ctl} · ATL {fatigue.atl} · TSB {fatigue.tsb > 0 ? "+" : ""}
              {fatigue.tsb}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {fatigue.restDaysSinceLastRun} day{fatigue.restDaysSinceLastRun === 1 ? "" : "s"}{" "}
              since last run
            </p>
          </div>
        </div>
        <ul className="space-y-1 text-sm text-zinc-500">
          {fatigue.evidence.map((e, i) => (
            <li key={i}>• {e}</li>
          ))}
        </ul>
        {loadHistory.length >= 2 && <FatigueChart data={loadHistory} />}
        <WhatThisMeans formula="TSB = CTL − ATL">
          CTL is a slow-moving fitness estimate; ATL reflects recent load. Positive TSB suggests
          freshness for quality work. Not medical advice — use feel + sleep to confirm.
        </WhatThisMeans>
      </CardContent>
    </Card>
  );
}
