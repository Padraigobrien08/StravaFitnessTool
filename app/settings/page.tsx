"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStrava } from "@/lib/context/strava-context";
import { useSettingsStore } from "@/stores/settings-store";
import { RaceGoalPicker } from "@/components/goals/race-goal-picker";
import { DataQualityPanel } from "@/components/layout/data-quality-panel";
import { StravaWebhookCard } from "@/components/settings/strava-webhook-card";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";

export default function SettingsPage() {
  const { clearData, importData, dataSources, dataSourceLabel, apiConnected } =
    useStrava();
  const { quality } = useTrainingIntelligence();
  const {
    distanceUnit,
    paceUnit,
    defaultWeeklyRuns,
    maxWeeklyKm,
    setDistanceUnit,
    setPaceUnit,
    setDefaultWeeklyRuns,
    setMaxWeeklyKm,
  } = useSettingsStore();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-display text-2xl font-bold text-white">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Import & privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-400">
          <p>
            Summary runs live in localStorage (export and/or API merge). Stream
            and lap detail live in IndexedDB (FIT upload or Strava API). We
            never load your email from profile.csv.
          </p>
          {importData && (
            <ul className="list-inside list-disc space-y-1 text-zinc-500">
              <li>
                Data: {dataSourceLabel ?? "loaded"} — {importData.runs.length}{" "}
                runs
              </li>
              <li>
                Strava API: {apiConnected ? "connected" : "not connected"}
              </li>
              <li>
                Local export file: {dataSources.localExport ? "yes" : "no"}
              </li>
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/import">
              <Button variant="outline" size="sm">
                Manage import
              </Button>
            </Link>
            {importData && (
              <Button variant="ghost" size="sm" onClick={() => void clearData()}>
                Clear all data & disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <StravaWebhookCard apiConnected={apiConnected} />

      <RaceGoalPicker />

      <Card>
        <CardHeader>
          <CardTitle>Training plan limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm text-zinc-500">
            Default runs per week (when Strava has no goal)
            <input
              type="number"
              min={1}
              max={7}
              value={defaultWeeklyRuns}
              onChange={(e) =>
                setDefaultWeeklyRuns(Number(e.target.value) || 3)
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm text-zinc-500">
            Max weekly km for adaptive plan (0 = auto from your history)
            <input
              type="number"
              min={0}
              max={200}
              step={5}
              value={maxWeeklyKm}
              onChange={(e) => setMaxWeeklyKm(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-200"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm text-zinc-500">
            Distance
            <select
              value={distanceUnit}
              onChange={(e) =>
                setDistanceUnit(e.target.value as "km" | "mi")
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-200"
            >
              <option value="km">Kilometres</option>
              <option value="mi">Miles</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-500">
            Pace
            <select
              value={paceUnit}
              onChange={(e) =>
                setPaceUnit(e.target.value as "min/km" | "min/mi")
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-200"
            >
              <option value="min/km">min/km</option>
              <option value="min/mi">min/mile</option>
            </select>
          </label>
          <p className="text-xs text-zinc-600">
            Unit conversion on charts is coming in the next release; preference is
            saved now.
          </p>
        </CardContent>
      </Card>

      {quality && <DataQualityPanel report={quality} />}

      <Card>
        <CardHeader>
          <CardTitle>Activity mix</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/activity-mix" className="text-sm text-emerald-400">
            View cross-training breakdown →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
