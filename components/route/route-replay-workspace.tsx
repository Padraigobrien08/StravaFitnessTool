"use client";

import { useEffect, useMemo } from "react";
import type { RouteIntelligenceSession } from "@/lib/route-intelligence/types";
import { RouteMap } from "./route-map";
import { RouteTelemetryPanel } from "./route-telemetry";
import { RouteReplayControls } from "./route-replay-controls";
import { RouteOverlayLegend } from "./route-overlay-legend";
import { useRouteReplay } from "./use-route-replay";
import { dash } from "@/components/home/primitives/tokens";
import { formatDistanceKm, formatDuration } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

export function RouteReplayWorkspace({
  session,
  backHref,
}: {
  session: RouteIntelligenceSession;
  backHref: string;
}) {
  const duration =
    session.geometry?.durationSec ?? session.timeline[session.timeline.length - 1]?.elapsedSec ?? 1;

  const { state, setTime, togglePlay, setSpeed, pause } = useRouteReplay(duration);

  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent<number>).detail;
      if (typeof t === "number") {
        pause();
        setTime(t);
      }
    };
    window.addEventListener("route-scrub", handler);
    return () => window.removeEventListener("route-scrub", handler);
  }, [setTime, pause]);

  const stats = useMemo(() => {
    if (!session.geometry) return null;
    return {
      distance: formatDistanceKm(session.geometry.totalDistanceM),
      duration: formatDuration(Math.round(session.geometry.durationSec)),
    };
  }, [session.geometry]);

  if (!session.hasGps || !session.geometry) {
    return (
      <div className="route-terminal rounded-xl border border-white/[0.06] p-8 text-center">
        <MapPin className="mx-auto h-10 w-10 text-zinc-600" />
        <h2 className="mt-4 font-display text-lg font-bold text-white">No GPS route data</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Spatial replay requires latitude/longitude streams. Re-sync this run from Strava (streams
          include latlng) or re-import the FIT file with GPS records.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-2 text-sm text-teal-400/90 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workout
        </Link>
      </div>
    );
  }

  return (
    <div className="route-terminal flex flex-col overflow-hidden rounded-xl border border-white/[0.06]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div>
          <Link
            href={backHref}
            className="mb-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Workout
          </Link>
          <p className={dash.labelAccent}>Movement intelligence</p>
          <h1 className="font-display text-lg font-bold text-white sm:text-xl">
            {session.runName}
          </h1>
          {stats ? (
            <p className="text-xs text-zinc-500">
              {stats.distance} · {stats.duration} · synchronized replay
            </p>
          ) : null}
        </div>
        <span className="rounded-md border border-teal-500/15 bg-teal-500/[0.06] px-2.5 py-1 text-[10px] font-medium text-teal-400/90">
          Spatial intelligence · Phase 1
        </span>
      </header>

      <div className="grid min-h-[420px] flex-1 grid-cols-1 lg:grid-cols-[1fr_minmax(0,1.1fr)]">
        <div className="relative min-h-[280px] border-b border-white/[0.06] lg:border-b-0 lg:border-r">
          <RouteMap
            geometry={session.geometry}
            timeline={session.timeline}
            currentSec={state.currentSec}
            overlays={session.overlays}
            className="h-full min-h-[320px] w-full"
          />
        </div>
        <div className="flex min-h-0 flex-col">
          <RouteReplayControls
            state={state}
            onTogglePlay={togglePlay}
            onRestart={() => setTime(0)}
            onSpeed={setSpeed}
          />
          <RouteOverlayLegend
            overlays={session.overlays}
            elevationSegments={session.elevationSegments}
          />
          <RouteTelemetryPanel
            timeline={session.timeline}
            currentSec={state.currentSec}
            overlays={session.overlays}
            hasPace={session.hasPace}
            hasHr={session.hasHr}
            hasElevation={session.hasElevation}
          />
        </div>
      </div>
    </div>
  );
}
