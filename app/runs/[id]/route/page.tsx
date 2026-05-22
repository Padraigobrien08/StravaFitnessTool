"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { getFitDetail, mergeFitDetails } from "@/lib/storage/fit-db";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { FitRunDetailSchema } from "@/lib/strava/fitTypes";
import { workoutLabelsByRunId } from "@/lib/analytics/workoutType";
import { buildRouteIntelligenceSession } from "@/lib/route-intelligence";
import { RouteReplayWorkspace } from "@/components/route/route-replay-workspace";
import { ops } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

export default function RouteReplayPage() {
  const params = useParams();
  const id = params.id as string;
  const { getRunById, insights, getFitDetailForRun } = useStrava();
  const run = getRunById(id);
  const [fit, setFit] = useState<FitRunDetail | null>(
    () => getFitDetailForRun(id) ?? null
  );
  const [loading, setLoading] = useState(false);

  const workout = useMemo(() => {
    if (!insights) return undefined;
    return workoutLabelsByRunId(insights.workoutLabels).get(id);
  }, [insights, id]);

  const session = useMemo(() => {
    if (!run) return null;
    return buildRouteIntelligenceSession(run, fit, workout?.type);
  }, [run, fit, workout?.type]);

  useEffect(() => {
    const fromCtx = getFitDetailForRun(id);
    if (fromCtx?.gpsStream?.length) setFit(fromCtx);
  }, [id, getFitDetailForRun]);

  useEffect(() => {
    if (!id || (fit?.gpsStream?.length ?? 0) > 0) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const local = await getFitDetail(id);
        if (local?.gpsStream?.length) {
          if (!cancelled) setFit(local);
          return;
        }
        const res = await fetch(`/api/me/fit-details/${id}`);
        if (!res.ok) return;
        const detail = FitRunDetailSchema.parse(await res.json());
        if (!cancelled) {
          await mergeFitDetails([detail]);
          setFit(detail);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, fit?.gpsStream?.length]);

  return (
    <RequireData>
      <div className={cn(ops.dashboard, "dashboard-enter w-full pb-8")}>
        {loading && !session?.hasGps ? (
          <p className="text-sm text-zinc-500">Loading GPS streams…</p>
        ) : null}
        {session ? (
          <RouteReplayWorkspace
            session={session}
            backHref={`/runs/${id}`}
          />
        ) : run ? (
          <RouteReplayWorkspace
            session={{
              activityId: id,
              runName: run.name,
              date: run.date,
              timeline: [],
              geometry: null,
              overlays: [],
              elevationSegments: [],
              hasGps: false,
              hasElevation: false,
              hasPace: false,
              hasHr: false,
            }}
            backHref={`/runs/${id}`}
          />
        ) : (
          <p className="text-zinc-500">Run not found.</p>
        )}
      </div>
    </RequireData>
  );
}
