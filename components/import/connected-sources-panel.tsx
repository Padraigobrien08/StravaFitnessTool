"use client";

import Link from "next/link";
import { Panel, Eyebrow } from "@/components/console/console-kit";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { ConnectedSourceView } from "@/lib/import/viewModels";
import type { useStravaConnection } from "@/hooks/use-strava-connection";
import { cn } from "@/lib/utils";
import { Link2, RefreshCw, Unplug, Check, AlertTriangle } from "lucide-react";

const statusStyle = {
  connected: "text-accent bg-accent/12 ring-accent/25",
  disconnected: "text-zinc-500 bg-[var(--surface-subdued)] ring-[var(--border-subtle)]",
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
    <Panel>
      <Eyebrow className="mb-3">Connected training sources</Eyebrow>
      <p className="mb-4 text-[13px] text-muted-foreground">
        API and export sources merge: nothing is replaced without your action.
      </p>

      <div className="space-y-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className="rounded-xl bg-[var(--surface-subdued)] p-4 ring-1 ring-[var(--border-subtle)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">{source.name}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
                      statusStyle[source.status],
                    )}
                  >
                    {source.statusLabel}
                  </span>
                  <ConfidenceBadge level={source.confidence} />
                </div>
              </div>
              {source.id === "strava" && status?.connected ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void handleSync()} disabled={syncing}>
                    <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", syncing && "animate-spin")} />
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
                  className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-[var(--home-signal-ink)] transition hover:opacity-90"
                  style={{ background: "var(--home-signal)" }}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Connect
                </a>
              ) : null}
            </div>

            {source.id === "strava" && !status?.connected ? (
              <p className="mt-2 text-[11px] leading-snug text-zinc-600">
                Connecting on localhost? In your{" "}
                <a
                  href="https://www.strava.com/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent/80"
                >
                  Strava API settings
                </a>
                , set <span className="text-zinc-400">Authorization Callback Domain</span> to{" "}
                <code className="rounded bg-[var(--surface-subdued)] px-1 text-zinc-300">
                  localhost
                </code>
                , no “http://”, no port.
              </p>
            ) : null}

            {source.runsSynced > 0 || source.activitiesAvailable > 0 ? (
              <p className="mt-3 text-xs text-zinc-500">
                {source.runsSynced > 0 ? `${source.runsSynced} runs synced` : null}
                {source.activitiesAvailable > 0
                  ? `${source.runsSynced > 0 ? " · " : ""}${source.activitiesAvailable} activities`
                  : null}
                {source.streamsLoaded > 0 ? ` · ${source.streamsLoaded} with streams` : null}
                {source.streamsPending > 0 ? ` · ${source.streamsPending} pending` : null}
              </p>
            ) : null}

            {source.lastSyncHint ? (
              <p className="mt-1 text-[11px] text-zinc-600">{source.lastSyncHint}</p>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Enabled
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {source.enabledCapabilities.length > 0 ? (
                    source.enabledCapabilities.map((c) => (
                      <li key={c} className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Check className="h-3 w-3 text-accent" />
                        {c}
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-zinc-600">—</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Missing
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {source.missingItems.length > 0 ? (
                    source.missingItems.map((m) => (
                      <li key={m} className="flex items-center gap-1.5 text-xs text-amber-400/85">
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
        <p className="mt-4 rounded-lg bg-[var(--surface-subdued)] px-3 py-2 text-xs text-zinc-400 ring-1 ring-inset ring-[var(--border-subtle)]">
          {message}
        </p>
      ) : null}

      {stravaView && status?.connected && (status.runsMissingStreams ?? 0) > 0 ? (
        <p className="mt-3 text-xs text-zinc-600">
          Tip: open any{" "}
          <Link href="/runs" className="text-accent hover:underline">
            run page
          </Link>{" "}
          to fetch streams on demand, or sync again (40 runs per batch).
        </p>
      ) : null}
    </Panel>
  );
}
