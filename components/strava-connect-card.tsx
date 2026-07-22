"use client";

import { Button } from "@/components/ui/button";
import { useStravaConnection } from "@/hooks/use-strava-connection";
import { Link2, RefreshCw, Unplug } from "lucide-react";

interface StravaConnectCardProps {
  /** Pull latest activities into app state (no full page reload). */
  onSynced?: () => void | Promise<void>;
  stravaQuery?: string | null;
}

export function StravaConnectCard({ onSynced, stravaQuery }: StravaConnectCardProps) {
  const { status, syncing, message, handleSync, handleDisconnect } = useStravaConnection(
    stravaQuery,
    onSynced,
  );

  if (status === null) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-500">
        Checking Strava connection…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Connect Strava</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Sync runs from the API instead of waiting for a bulk export. FIT streams remain optional
            for segment PRs.
          </p>
        </div>
        {status.connected ? (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
            Connected
          </span>
        ) : null}
      </div>

      {status.connected ? (
        <p className="mt-4 text-sm text-zinc-400">
          {status.runs ?? 0} runs · {status.streams ?? 0} with streams
          {(status.runsMissingStreams ?? 0) > 0
            ? ` · ${status.runsMissingStreams} need stream sync`
            : ""}{" "}
          · {status.activities ?? 0} activities in store
        </p>
      ) : null}

      {message ? <p className="mt-3 text-sm text-zinc-300">{message}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {!status.connected ? (
          <a
            href="/api/auth/strava/authorize"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-500 px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            <Link2 className="mr-2 h-4 w-4" />
            Connect with Strava
          </a>
        ) : (
          <>
            <Button onClick={() => void handleSync()} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="ghost" onClick={() => void handleDisconnect()}>
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
