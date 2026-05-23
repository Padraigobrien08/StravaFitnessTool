"use client";

import { useState } from "react";
import { ForecastV2Panel } from "@/components/goals/forecast-v2-panel";
import type { ForecastV2View } from "@/lib/goals/forecastV2ViewModel";
import type { RaceProjectionView } from "@/lib/performance/viewModels";
import { PredictionIntegrityPanel } from "@/components/goals/prediction-integrity-panel";
import { PredictionConsensusPanel } from "@/components/goals/prediction-consensus-panel";
import type { ModelConsensusRow } from "@/lib/goals/viewModels";
import type { RacePredictionAnalysis } from "@/lib/analytics/predictions";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function GoalsEvidenceDrawer({
  forecast,
  showLegacy,
  projection,
  consensus,
  analysis,
}: {
  forecast: ForecastV2View;
  showLegacy: boolean;
  projection: RaceProjectionView;
  consensus: ModelConsensusRow[];
  analysis: RacePredictionAnalysis;
}) {
  const [open, setOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left text-sm text-zinc-400 transition-colors hover:bg-white/[0.04]"
      >
        <span>See models &amp; math</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-600 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <ForecastV2Panel forecast={forecast} />
        </div>
      ) : null}

      {showLegacy ? (
        <>
          <button
            type="button"
            onClick={() => setLegacyOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-white/[0.08] px-4 py-2.5 text-left text-xs text-zinc-600 hover:text-zinc-500"
          >
            <span>Compare legacy V1 estimate</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                legacyOpen && "rotate-180"
              )}
            />
          </button>
          {legacyOpen ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <PredictionIntegrityPanel projection={projection} />
              <PredictionConsensusPanel rows={consensus} analysis={analysis} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
