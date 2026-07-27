"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { getFitDetail, mergeFitDetails } from "@/lib/storage/fit-db";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { FitRunDetailSchema } from "@/lib/strava/fitTypes";
import { workoutLabelsByRunId } from "@/lib/analytics/workoutType";
import { buildWorkoutDetailView } from "@/lib/runs/workoutDetailViewModels";
import { WorkoutIntelligenceHero } from "@/components/run-detail/workout-intelligence-hero";
import { WorkoutInterpretationPanel } from "@/components/run-detail/run-detail-panels";
import { ExecutionAnalysisPanel } from "@/components/run-detail/execution-analysis-panel";
import { StreamIntelligencePanel } from "@/components/run-detail/stream-intelligence-panel";
import { SegmentAnalysisPanel } from "@/components/run-detail/segment-analysis-panel";
import { AdaptationSignalsPanel } from "@/components/run-detail/adaptation-signals-panel";
import {
  HistoricalContextPanel,
  WorkoutQualityPanel,
  CompactStatsRail,
} from "@/components/run-detail/run-detail-panels";
import { ops } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { ArrowLeft, Map } from "lucide-react";

export default function RunDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { getRunById, importData, insights, fitRunIds, getFitDetailForRun } = useStrava();
  const run = getRunById(id);
  const [fit, setFit] = useState<FitRunDetail | null>(() => getFitDetailForRun(id) ?? null);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamsError, setStreamsError] = useState<string | null>(null);

  const workout = useMemo(() => {
    if (!insights) return undefined;
    return workoutLabelsByRunId(insights.workoutLabels).get(id);
  }, [insights, id]);

  const view = useMemo(() => {
    if (!run || !workout) return null;
    return buildWorkoutDetailView(run, workout, fit, importData?.runs ?? [], insights);
  }, [run, workout, fit, importData?.runs, insights]);

  useEffect(() => {
    const fromContext = getFitDetailForRun(id);
    if (fromContext) setFit(fromContext);
  }, [id, getFitDetailForRun]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadStreams() {
      setStreamsError(null);
      const fromCtx = getFitDetailForRun(id);
      if (
        fromCtx &&
        (fromCtx.paceStream.length > 0 || fromCtx.hrStream.length > 0 || fromCtx.laps.length > 0)
      ) {
        setFit(fromCtx);
        return;
      }
      const local = await getFitDetail(id);
      if (cancelled) return;
      if (
        local &&
        (local.paceStream.length > 0 || local.hrStream.length > 0 || local.laps.length > 0)
      ) {
        setFit(local);
        return;
      }

      setStreamsLoading(true);
      try {
        const res = await fetch(`/api/me/fit-details/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setStreamsError(
              "No stream data from Strava for this run yet. Use Import → Sync to backfill.",
            );
          } else {
            const body = await res.json().catch(() => ({}));
            setStreamsError((body as { error?: string }).error ?? "Could not load streams");
          }
          return;
        }
        const detail = FitRunDetailSchema.parse(await res.json());
        if (cancelled) return;
        await mergeFitDetails([detail]);
        setFit(detail);
      } catch {
        if (!cancelled) setStreamsError("Failed to load activity streams.");
      } finally {
        if (!cancelled) setStreamsLoading(false);
      }
    }

    void loadStreams();
    return () => {
      cancelled = true;
    };
  }, [id, getFitDetailForRun]);

  const listedWithStreams = fitRunIds.includes(id);
  const hasStreamData =
    fit && (fit.paceStream.length > 0 || fit.hrStream.length > 0 || fit.laps.length > 0);

  return (
    <RequireData>
      {run && workout && view ? (
        <div className={cn(ops.dashboard, "dashboard-enter w-full pb-8")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/runs"
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Activity explorer
            </Link>
            <Link
              href={`/runs/${id}/route`}
              className="inline-flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/[0.08] px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/[0.14]"
            >
              <Map className="h-3.5 w-3.5" />
              Route replay
            </Link>
          </div>

          <WorkoutIntelligenceHero hero={view.hero} />
          <WorkoutInterpretationPanel text={view.interpretation} />
          <ExecutionAnalysisPanel data={view.execution} />
          <AdaptationSignalsPanel signals={view.adaptations} />

          <div className="grid gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-5">
            <div className="lg:col-span-7">
              <StreamIntelligencePanel
                fit={hasStreamData ? fit : null}
                annotations={view.streamAnnotations}
                loading={streamsLoading}
                error={streamsError}
              />
            </div>
            <div className="lg:col-span-5">
              <HistoricalContextPanel items={view.historical} />
            </div>
          </div>

          <SegmentAnalysisPanel segments={view.segments} />
          <CompactStatsRail stats={view.compactStats} />

          {run.description ? (
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Athlete notes
              </p>
              <p className="mt-1 text-sm text-zinc-300">{run.description}</p>
            </div>
          ) : null}

          <WorkoutQualityPanel data={view.quality} />

          {!fit && !listedWithStreams && run.fitFilename && (
            <p className="text-sm text-zinc-500">
              FIT file referenced ({run.fitFilename}) but not loaded. Re-import your Strava export
              including <code className="text-accent/90">activities/</code>.
            </p>
          )}
        </div>
      ) : run && !workout ? (
        <p className="text-zinc-500">Loading workout classification…</p>
      ) : null}
      {!run && (
        <p className="text-zinc-500">
          Run not found.{" "}
          <Link href="/runs" className="text-accent">
            Back to runs
          </Link>
        </p>
      )}
    </RequireData>
  );
}
