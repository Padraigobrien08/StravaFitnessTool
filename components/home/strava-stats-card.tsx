"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import type { StravaActivityStats } from "@/lib/strava/api/fetchAthlete";
import { formatDistanceKm, formatDuration } from "@/lib/utils";

function formatTotal(total: StravaActivityStats["ytd_run_totals"] | undefined): {
  distance: string;
  count: string;
  time: string;
} {
  if (!total || total.count === 0) {
    return { distance: "—", count: "—", time: "—" };
  }
  return {
    distance: formatDistanceKm(total.distance),
    count: String(total.count),
    time: formatDuration(total.moving_time),
  };
}

export function StravaStatsCard({ apiConnected }: { apiConnected: boolean }) {
  const [stats, setStats] = useState<StravaActivityStats | null>(null);

  useEffect(() => {
    if (!apiConnected) return;
    void fetch("/api/me/athlete-stats")
      .then((r) => r.json())
      .then((body: { stats: StravaActivityStats | null }) => {
        setStats(body.stats ?? null);
      })
      .catch(() => setStats(null));
  }, [apiConnected]);

  if (!apiConnected || !stats) return null;

  const ytd = formatTotal(stats.ytd_run_totals);
  const recent = formatTotal(stats.recent_run_totals);

  return (
    <Card className="border-white/10">
      <CardHeader>
        <CardTitle>Strava totals</CardTitle>
        <p className="text-sm text-zinc-500">
          Official roll-ups from your connected account (last 4 weeks vs YTD).
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="YTD runs" value={ytd.count} subtitle={ytd.distance} />
          <KpiCard title="YTD time" value={ytd.time} subtitle="moving time" />
          <KpiCard
            title="Last 4 weeks"
            value={recent.count}
            subtitle={`${recent.distance} · ${recent.time}`}
          />
          <KpiCard
            title="All-time runs"
            value={String(stats.all_run_totals?.count ?? "—")}
            subtitle={
              stats.all_run_totals?.distance ? formatDistanceKm(stats.all_run_totals.distance) : "—"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
