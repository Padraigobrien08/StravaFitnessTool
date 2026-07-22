"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatThisMeans } from "@/components/layout/what-this-means";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { PredictionChart } from "./prediction-chart";
import type { RacePredictionAnalysis } from "@/lib/analytics/predictions";
import { formatDuration, formatPace } from "@/lib/utils";
import Link from "next/link";

export function RacePredictionsPanel({ analysis }: { analysis: RacePredictionAnalysis }) {
  if (analysis.consensus.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Race time predictions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Need at least one quality effort between 4–15 km. Import FIT data for best segment
          detection, or complete a timed 5K/10K run.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {analysis.consensus.map((c) => (
          <div key={c.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-white tabular-nums">
              {formatDuration(c.timeSec)}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {formatPace(c.timeSec / c.distanceKm)} avg
              {c.spreadSec > 45 && (
                <span className="ml-1 text-zinc-500">
                  (±{formatDuration(Math.round(c.spreadSec / 2))})
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>How we predict your race times</CardTitle>
          <ConfidenceBadge level={analysis.confidence} />
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-zinc-400">
            {analysis.explanation.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
          {analysis.primaryAnchor && (
            <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
              <span className="text-zinc-500">Primary anchor: </span>
              <Link
                href={`/runs/${analysis.primaryAnchor.runId}`}
                className="text-emerald-400 hover:underline"
              >
                {analysis.primaryAnchor.runName}
              </Link>
              {" — "}
              {formatDuration(analysis.primaryAnchor.timeSec)} at{" "}
              {analysis.primaryAnchor.distanceKm.toFixed(1)} km ({analysis.primaryAnchor.source})
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance curve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-zinc-500">
            Green dots = efforts from your data. Lines = model extrapolations. Vertical guides mark
            5K, 10K, half, and marathon.
          </p>
          <PredictionChart analysis={analysis} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-zinc-500">
                <th className="pb-3 pr-4">Distance</th>
                <th className="pb-3 pr-4">Consensus</th>
                <th className="pb-3 pr-4">Range</th>
                {analysis.models.map((m) => (
                  <th key={m.id} className="pb-3 pr-4 whitespace-nowrap">
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.consensus.map((c) => (
                <tr key={c.label} className="border-b border-white/5 text-zinc-300">
                  <td className="py-3 pr-4 font-medium text-white">{c.label}</td>
                  <td className="py-3 pr-4 tabular-nums text-emerald-400">
                    {formatDuration(c.timeSec)}
                    <span className="ml-2 text-xs text-zinc-600">
                      {formatPace(c.timeSec / c.distanceKm)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-zinc-500 tabular-nums">
                    {c.spreadSec > 0
                      ? `${formatDuration(c.timeMin)} – ${formatDuration(c.timeMax)}`
                      : "—"}
                  </td>
                  {analysis.models.map((m) => {
                    const p = m.predictions.find((x) => x.label === c.label);
                    return (
                      <td key={m.id} className="py-3 pr-4 tabular-nums text-zinc-400">
                        {p ? formatDuration(p.timeSec) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {analysis.models.map((m) => (
          <WhatThisMeans key={m.id} formula={m.formula}>
            <strong className="text-zinc-200">{m.name}</strong>
            <br />
            {m.description}
            {m.anchorLabel && (
              <>
                <br />
                <span className="text-zinc-500">Anchor: {m.anchorLabel}</span>
              </>
            )}
            {m.rSquared !== undefined && (
              <>
                <br />
                <span className="text-zinc-500">R² = {m.rSquared}</span>
              </>
            )}
          </WhatThisMeans>
        ))}
      </div>
    </div>
  );
}
