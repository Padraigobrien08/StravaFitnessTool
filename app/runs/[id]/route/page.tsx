"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { getFitDetail, mergeFitDetails } from "@/lib/storage/fit-db";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { FitRunDetailSchema } from "@/lib/strava/fitTypes";
import { fitDetailHasGps } from "@/lib/strava/fitStreamCompleteness";
import { workoutLabelsByRunId } from "@/lib/analytics/workoutType";
import { buildRouteIntelligenceSession } from "@/lib/route-intelligence";
import { RouteReplayWorkspace } from "@/components/route/route-replay-workspace";
import { ops } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function RouteReplayPage() {
  const params = useParams();
  const id = params.id as string;
  const { getRunById, insights, getFitDetailForRun, apiConnected } = useStrava();
  const run = getRunById(id);
  const [fit, setFit] = useState<FitRunDetail | null>(
    () => getFitDetailForRun(id) ?? null
  );
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const autoLoadedRef = useRef(false);

  const workout = useMemo(() => {
    if (!insights) return undefined;
    return workoutLabelsByRunId(insights.workoutLabels).get(id);
  }, [insights, id]);

  const session = useMemo(() => {
    if (!run) return null;
    return buildRouteIntelligenceSession(run, fit, workout?.type);
  }, [run, fit, workout?.type]);

  const loadStreams = useCallback(
    async (forceRefresh: boolean) => {
      if (!id) return;
      setLoading(true);
      setFetchError(null);
      try {
        const local = await getFitDetail(id);
        if (local && fitDetailHasGps(local) && !forceRefresh) {
          setFit(local);
          return;
        }

        const fromCtx = getFitDetailForRun(id);
        if (fromCtx && fitDetailHasGps(fromCtx) && !forceRefresh) {
          setFit(fromCtx);
          return;
        }

        const isStravaId = Number.isFinite(Number(id));
        if (!isStravaId) {
          if (local) setFit(local);
          else if (fromCtx) setFit(fromCtx);
          setFetchError(
            "GPS replay for local CSV imports requires matching FIT files with GPS records."
          );
          return;
        }

        if (!apiConnected && !forceRefresh) {
          setFetchError(
            "Connect Strava and sync streams to load GPS for this activity."
          );
          return;
        }

        const res = await fetch(`/api/me/fit-details/${id}?refresh=1`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setFetchError(
            (body as { error?: string }).error ??
              "Could not load activity streams from Strava."
          );
          return;
        }
        const detail = FitRunDetailSchema.parse(await res.json());
        await mergeFitDetails([detail]);
        setFit(detail);
        if (!fitDetailHasGps(detail)) {
          setFetchError(
            "Strava returned no lat/lng for this activity (e.g. indoor or privacy)."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [id, getFitDetailForRun, apiConnected]
  );

  useEffect(() => {
    autoLoadedRef.current = false;
  }, [id]);

  useEffect(() => {
    const fromCtx = getFitDetailForRun(id);
    if (fromCtx && fitDetailHasGps(fromCtx)) {
      setFit(fromCtx);
      return;
    }
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    void loadStreams(false);
  }, [id, getFitDetailForRun, loadStreams]);

  const emptySession = run
    ? {
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
      }
    : null;

  return (
    <RequireData>
      <div className={cn(ops.dashboard, "dashboard-enter w-full pb-8")}>
        {loading && !session?.hasGps ? (
          <p className="text-sm text-zinc-500">Loading GPS streams…</p>
        ) : null}

        {fetchError && !session?.hasGps ? (
          <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-200/80">
            {fetchError}
          </p>
        ) : null}

        {session?.hasGps ? (
          <RouteReplayWorkspace session={session} backHref={`/runs/${id}`} />
        ) : run && emptySession ? (
          <div className="space-y-3">
            <RouteReplayWorkspace
              session={emptySession}
              backHref={`/runs/${id}`}
            />
            {apiConnected ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void loadStreams(true)}
                >
                  {loading ? "Fetching…" : "Fetch GPS from Strava"}
                </Button>
                <Link href="/import">
                  <Button size="sm" variant="ghost" className="text-zinc-500">
                    Sync more streams
                  </Button>
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-zinc-500">Run not found.</p>
        )}
      </div>
    </RequireData>
  );
}
