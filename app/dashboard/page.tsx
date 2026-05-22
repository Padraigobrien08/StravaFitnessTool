"use client";

import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { KpiCard } from "@/components/kpi-card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VolumeChart } from "@/components/charts";
import { useStrava } from "@/lib/context/strava-context";
import { formatPace, formatDistanceKm } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { insights } = useStrava();

  return (
    <RequireData>
      {insights && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-display text-2xl font-bold text-white">Dashboard</h1>
            <ConfidenceBadge level={insights.dataConfidence} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total runs"
              value={String(insights.summary.runCount)}
              subtitle={
                insights.summary.dateRange
                  ? `${new Date(insights.summary.dateRange.start).toLocaleDateString(undefined, { month: "short", year: "numeric" })} – ${new Date(insights.summary.dateRange.end).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                  : undefined
              }
            />
            <KpiCard
              title="All-time distance"
              value={`${insights.summary.totalDistanceKm} km`}
            />
            <KpiCard
              title="Avg pace"
              value={
                insights.summary.avgPaceSecPerKm
                  ? formatPace(insights.summary.avgPaceSecPerKm)
                  : "—"
              }
              subtitle={
                insights.summary.avgHr
                  ? `Avg HR ${insights.summary.avgHr} bpm`
                  : undefined
              }
            />
            <KpiCard
              title="Last 7 days"
              value={`${insights.summary.last7DaysKm} km`}
              subtitle={`${insights.summary.last7DaysRuns} runs`}
              accent="linear-gradient(90deg, #34d399, #6ee7b7)"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Weekly volume</CardTitle>
              </CardHeader>
              <CardContent>
                {insights.weeklyVolume.length < 2 ? (
                  <p className="text-sm text-zinc-500">
                    Only {insights.weeklyVolume.length} week of data — import more runs for trends.
                  </p>
                ) : (
                  <VolumeChart data={insights.weeklyVolume} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Half-marathon readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <span className="font-display text-5xl font-bold text-emerald-400">
                    {insights.halfMarathonReadiness.score}
                  </span>
                  <span className="pb-2 text-lg text-zinc-400">
                    / 100 · {insights.halfMarathonReadiness.label}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-zinc-400">
                  <p>
                    Longest run:{" "}
                    <span className="text-zinc-200">
                      {formatDistanceKm(insights.halfMarathonReadiness.longestRunKm * 1000)}
                    </span>{" "}
                    ({insights.halfMarathonReadiness.longestRunPct}% of 21.1 km)
                  </p>
                  <p>
                    4-week volume:{" "}
                    <span className="text-zinc-200">
                      {insights.halfMarathonReadiness.fourWeekVolumeKm} km
                    </span>{" "}
                    ({insights.halfMarathonReadiness.volumePct}% of ~160 km target)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {insights.bestBlock && (
            <Card>
              <CardHeader>
                <CardTitle>Best 4-week block</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-zinc-300">
                  {insights.bestBlock.label}:{" "}
                  <strong className="text-white">
                    {insights.bestBlock.distanceKm} km
                  </strong>{" "}
                  · {insights.bestBlock.runCount} runs · longest{" "}
                  {insights.bestBlock.longestRunKm} km
                </p>
                <Link href="/training">
                  <Button variant="outline" size="sm">
                    Training analysis
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="no-print flex flex-wrap gap-3">
            <Link href="/runs">
              <Button variant="outline" size="sm">
                Browse runs
              </Button>
            </Link>
            <Link href="/report">
              <Button variant="outline" size="sm">
                Export report
              </Button>
            </Link>
          </div>

          {insights.goalProgress && (
            <Card>
              <CardHeader>
                <CardTitle>Weekly goal — {insights.goalProgress.goalLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-300">
                  This week:{" "}
                  <strong className="text-white">
                    {insights.goalProgress.currentWeekRuns} / {insights.goalProgress.targetPerWeek}
                  </strong>{" "}
                  runs
                  {insights.goalProgress.met ? (
                    <span className="ml-2 text-emerald-400">✓ on track</span>
                  ) : (
                    <span className="ml-2 text-amber-400">needs more runs</span>
                  )}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Met goal in {insights.goalProgress.weeksMet} of{" "}
                  {insights.goalProgress.weeksTotal} weeks since start
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </RequireData>
  );
}
