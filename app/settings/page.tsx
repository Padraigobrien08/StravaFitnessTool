"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel, Eyebrow } from "@/components/console/console-kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStrava } from "@/lib/context/strava-context";
import { useSettingsStore } from "@/stores/settings-store";
import { ThemeSegmentedControl } from "@/components/theme/theme-toggle";
import { RaceGoalPicker } from "@/components/goals/race-goal-picker";
import { DataQualityPanel } from "@/components/layout/data-quality-panel";
import { StravaWebhookCard } from "@/components/settings/strava-webhook-card";
import { StravaMcpScopesCard } from "@/components/settings/strava-mcp-scopes-card";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";

export default function SettingsPage() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const { clearData, importData, dataSources, dataSourceLabel, apiConnected } = useStrava();
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
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="type-page-title">Settings</h1>

      <Panel>
        <Eyebrow className="mb-3">Appearance</Eyebrow>
        <div className="space-y-3">
          <p className="type-body-muted">
            Choose light or dark mode. Charts, maps, and panels adapt to your selection.
          </p>
          <ThemeSegmentedControl />
        </div>
      </Panel>

      <Panel>
        <Eyebrow className="mb-3">Import & privacy</Eyebrow>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Summary runs live in localStorage (export and/or API merge). Stream and lap detail live
            in IndexedDB (FIT upload or Strava API). We never load your email from profile.csv.
          </p>
          {importData && (
            <ul className="list-inside list-disc space-y-1 text-zinc-500">
              <li>
                Data: {dataSourceLabel ?? "loaded"} — {importData.runs.length} runs
              </li>
              <li>Strava API: {apiConnected ? "connected" : "not connected"}</li>
              <li>Local export file: {dataSources.localExport ? "yes" : "no"}</li>
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/import">
              <Button variant="outline" size="sm">
                Manage import
              </Button>
            </Link>
            {importData && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setClearDialogOpen(true)}>
                  Clear all data & disconnect
                </Button>
                <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                  <DialogContent showCloseButton={false} className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Clear all data?</DialogTitle>
                      <DialogDescription>
                        This removes your local runs, plans, and disconnects Strava from this
                        browser. You can import again later.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" size="sm" onClick={() => setClearDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setClearDialogOpen(false);
                          void clearData();
                        }}
                      >
                        Clear all data
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </Panel>

      <StravaWebhookCard apiConnected={apiConnected} />

      <StravaMcpScopesCard connected={apiConnected} />

      <RaceGoalPicker />

      <Panel>
        <Eyebrow className="mb-3">Training plan limits</Eyebrow>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-weekly-runs" className="text-muted-foreground">
              Default runs per week (when Strava has no goal)
            </Label>
            <Input
              id="default-weekly-runs"
              type="number"
              min={1}
              max={7}
              value={defaultWeeklyRuns}
              onChange={(e) => setDefaultWeeklyRuns(Number(e.target.value) || 3)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-weekly-km" className="text-muted-foreground">
              Max weekly km for adaptive plan (0 = auto from your history)
            </Label>
            <Input
              id="max-weekly-km"
              type="number"
              min={0}
              max={200}
              step={5}
              value={maxWeeklyKm}
              onChange={(e) => setMaxWeeklyKm(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <Eyebrow className="mb-3">Units</Eyebrow>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Distance</Label>
            <Select value={distanceUnit} onValueChange={(v) => setDistanceUnit(v as "km" | "mi")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="km">Kilometres</SelectItem>
                <SelectItem value="mi">Miles</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Pace</Label>
            <Select value={paceUnit} onValueChange={(v) => setPaceUnit(v as "min/km" | "min/mi")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="min/km">min/km</SelectItem>
                <SelectItem value="min/mi">min/mile</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-zinc-600">
            Applied across distances and paces app-wide. Changes take effect as you navigate.
          </p>
        </div>
      </Panel>

      {quality && <DataQualityPanel report={quality} />}

      <Panel>
        <Eyebrow className="mb-3">Activity mix</Eyebrow>
        <Link
          href="/context"
          className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          View cross-training breakdown →
        </Link>
      </Panel>
    </div>
  );
}
