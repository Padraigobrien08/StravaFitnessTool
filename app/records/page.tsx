"use client";

import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrava } from "@/lib/context/strava-context";
import { useEffect, useState } from "react";
import { countStaleFitDetails } from "@/lib/storage/fit-db";
import { formatPace, formatDuration } from "@/lib/utils";
import { RacePredictionsPanel } from "@/components/predictions/race-predictions-panel";
import { PrProgressionChart } from "@/components/progression/pr-progression-chart";

export default function RecordsPage() {
  const { insights, importData, fitRunIds } = useStrava();
  const [staleFit, setStaleFit] = useState(0);

  useEffect(() => {
    void countStaleFitDetails().then(setStaleFit);
  }, [fitRunIds.length, importData?.importedAt]);

  const hasFit = fitRunIds.length > 0;
  const needsReimport = hasFit && staleFit > 0;

  return (
    <RequireData>
      {insights && (
        <div className="space-y-8">
          <h1 className="font-display text-2xl font-bold text-white">Records & predictions</h1>
          {needsReimport ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              FIT data in your browser is from an older import and has no pace streams.
              Go to <a href="/import" className="underline">Import</a> → Step 2 and
              re-select your <code className="text-amber-100">activities</code> folder
              once more.
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              PRs use fastest <strong className="text-zinc-400">segments</strong> inside
              longer runs when stream/lap data is loaded ({fitRunIds.length}{" "}
              runs).
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Personal records</CardTitle>
            </CardHeader>
            <CardContent>
              {insights.personalRecords.length === 0 ? (
                <p className="text-sm text-zinc-500">No PRs found for standard distances.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-500">
                        <th className="pb-3 pr-4">Distance</th>
                        <th className="pb-3 pr-4">Run</th>
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4">Time</th>
                        <th className="pb-3 pr-4">Pace</th>
                        <th className="pb-3">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.personalRecords.map((pr) => (
                        <tr
                          key={pr.bucket}
                          className="border-b border-white/5 text-zinc-300"
                        >
                          <td className="py-3 pr-4 font-medium text-white">
                            {pr.label}
                          </td>
                          <td className="py-3 pr-4">
                            <Link
                              href={`/runs/${pr.runId}`}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              {pr.runName}
                            </Link>
                          </td>
                          <td className="py-3 pr-4">
                            {new Date(pr.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            {formatDuration(pr.timeSec)}
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-emerald-400">
                            {formatPace(pr.paceSecPerKm)}
                          </td>
                          <td className="py-3 text-xs text-zinc-500">
                            {pr.source === "full_run"
                              ? "Full run"
                              : pr.source === "laps"
                                ? "Lap block"
                                : "Best effort"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PR progression</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-xs text-zinc-500">
                Step changes when your best 5K, 10K, or half marathon effort
                improved over time (includes segments inside longer runs when
                FIT data is loaded).
              </p>
              <PrProgressionChart timeline={insights.prTimeline} />
            </CardContent>
          </Card>

          <RacePredictionsPanel analysis={insights.racePredictionAnalysis} />
        </div>
      )}
    </RequireData>
  );
}
