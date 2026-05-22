"use client";

import Link from "next/link";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { ConnectedSourceView } from "@/lib/import/viewModels";
import type { useStravaConnection } from "@/hooks/use-strava-connection";
import { cn } from "@/lib/utils";
import { dash } from "@/components/home/primitives/tokens";
import { Link2, RefreshCw, Unplug, Check, AlertTriangle } from "lucide-react";

const statusStyle = {
  connected: "text-teal-400 bg-teal-500/10 ring-teal-500/25",
  disconnected: "text-zinc-500 bg-white/[0.04] ring-white/[0.08]",
  partial: "text-amber-400 bg-amber-500/10 ring-amber-500/25",
};

export function ConnectedSourcesPanel({
  sources,
  connection,
}: {
  sources: ConnectedSourceView[];
  connection: ReturnType<typeof useStravaConnection>;
}) {
  const { status, syncing, message, handleSync, handleDisconnect } = connection;

  const stravaView = sources.find((s) => s.id === "strava");

  return (
    <PanelChrome title="Connected training sources" accent elevated>
      <p className={`${dash.muted} mb-4`}>
        API and export sources merge — nothing is replaced without your action.
      </p>

      <div className="space-y-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">{source.name}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
                      statusStyle[source.status]
                    )}
                  >
                    {source.statusLabel}
                  </span>
                  <ConfidenceBadge level={source.confidence} />
                </div>
              </div>
              {source.id === "strava" && status?.connected ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleSync()}
                    disabled={syncing}
                  >
                    <RefreshCw
                      className={cn("mr-1.5 h-3.5 w-3.5", syncing && "animate-spin")}
                    />
                    {syncing ? "Syncing…" : "Sync now"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void handleDisconnect()}>
                    <Unplug className="mr-1.5 h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                </div>
              ) : source.id === "strava" && !status?.connected ? (
                <a
                  href="/api/auth/strava/authorize"
                  className="inline-flex h-8 items-center rounded-lg bg-teal-600 px-3 text-xs font-medium text-zinc-950 hover:bg-teal-500"
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Connect
                </a>
              ) : null}
            </div>

            {source.runsSynced > 0 || source.activitiesAvailable > 0 ? (
              <p className="mt-3 text-xs text-zinc-500">
                {source.runsSynced > 0 ? `${source.runsSynced} runs synced` : null}
                {source.activitiesAvailable > 0
                  ? `${source.runsSynced > 0 ? " · " : ""}${source.activitiesAvailable} activities`
                  : null}
                {source.streamsLoaded > 0
                  ? ` · ${source.streamsLoaded} with streams`
                  : null}
                {source.streamsPending > 0
                  ? ` · ${source.streamsPending} pending`
                  : null}
              </p>
            ) : null}

            {source.lastSyncHint ? (
              <p className="mt-1 text-[11px] text-zinc-600">{source.lastSyncHint}</p>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className={dash.label}>Enabled</p>
                <ul className="mt-1.5 space-y-0.5">
                  {source.enabledCapabilities.length > 0 ? (
                    source.enabledCapabilities.map((c) => (
                      <li
                        key={c}
                        className="flex items-center gap-1.5 text-xs text-zinc-500"
                      >
                        <Check className="h-3 w-3 text-teal-500/70" />
                        {c}
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-zinc-600">—</li>
                  )}
                </ul>
              </div>
              <div>
                <p className={dash.label}>Missing</p>
                <ul className="mt-1.5 space-y-0.5">
                  {source.missingItems.length > 0 ? (
                    source.missingItems.map((m) => (
                      <li
                        key={m}
                        className="flex items-center gap-1.5 text-xs text-amber-400/85"
                      >
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {m}
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-zinc-600">Complete</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {message ? (
        <p className="mt-4 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 ring-1 ring-inset ring-white/[0.05]">
          {message}
        </p>
      ) : null}

      {stravaView && status?.connected && (status.runsMissingStreams ?? 0) > 0 ? (
        <p className="mt-3 text-xs text-zinc-600">
          Tip: open any{" "}
          <Link href="/runs" className="text-teal-400/90 hover:underline">
            run page
          </Link>{" "}
          to fetch streams on demand, or sync again (40 runs per batch).
        </p>
      ) : null}
    </PanelChrome>
  );
}
