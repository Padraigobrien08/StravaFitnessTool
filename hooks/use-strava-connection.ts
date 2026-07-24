"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface MeStatus {
  connected: boolean;
  stravaAthleteId?: string;
  activities?: number;
  runs?: number;
  streams?: number;
  runsMissingStreams?: number;
}

const OAUTH_HANDLED_KEY = "strideiq_oauth_connected_handled";

const ERROR_MESSAGES: Record<string, string> = {
  state:
    "Your connect link expired or your browser blocked the cookie. Please click Connect and finish within a few minutes.",
  token:
    "Strava rejected the connection. In your Strava API settings (strava.com/settings/api), set the “Authorization Callback Domain” to “localhost”, then try again.",
  db: "Connected to Strava, but saving your account failed. Check that DATABASE_URL points to a reachable, migrated database.",
  noathlete: "Strava didn’t return your athlete profile. Please try connecting again.",
  nocode: "Strava didn’t return an authorization code. Please try connecting again.",
};

export function useStravaConnection(
  stravaQuery: string | null | undefined,
  onSynced?: () => void | Promise<void>,
  errorReason?: string | null,
) {
  const router = useRouter();
  const [status, setStatus] = useState<MeStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const handledOAuthReturn = useRef(false);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/me/status");
    const data = (await res.json()) as MeStatus;
    setStatus(data);
    return data;
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (stravaQuery === "connected") {
      if (handledOAuthReturn.current || sessionStorage.getItem(OAUTH_HANDLED_KEY)) {
        router.replace("/import");
        return;
      }
      handledOAuthReturn.current = true;
      sessionStorage.setItem(OAUTH_HANDLED_KEY, "1");
      setMessage("Strava connected. Loading your activities…");
      router.replace("/import");
      void (async () => {
        await refreshStatus();
        await onSynced?.();
        setMessage("Strava connected. Activities loaded.");
      })();
    } else if (stravaQuery === "denied") {
      setMessage("Strava authorization was cancelled.");
      router.replace("/import");
    } else if (stravaQuery === "error") {
      setMessage(
        (errorReason && ERROR_MESSAGES[errorReason]) ??
          "Strava connection failed. Please try again.",
      );
      router.replace("/import");
    }
  }, [stravaQuery, errorReason, refreshStatus, onSynced, router]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      setMessage("Step 1/2 — syncing activities…");
      const res = await fetch("/api/sync/strava", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipStreams: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sync failed");

      const statusNow = await refreshStatus();
      const missing = statusNow.runsMissingStreams ?? 0;

      if (missing > 0) {
        setMessage(`Step 2/2 — syncing streams for up to 40 runs (${missing} pending)…`);
        const streamRes = await fetch("/api/sync/strava/streams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxRuns: 40 }),
        });
        const streamBody = await streamRes.json();
        if (!streamRes.ok) {
          throw new Error(streamBody.error ?? "Stream sync failed");
        }
        setMessage(
          `Synced ${body.synced} activities · ${streamBody.streamsSynced} stream sets` +
            (streamBody.remaining > 0 ? ` · ${streamBody.remaining} still pending` : ""),
        );
      } else {
        setMessage(`Synced ${body.synced} activities · streams up to date.`);
      }

      await refreshStatus();
      await onSynced?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem(OAUTH_HANDLED_KEY);
    setStatus({ connected: false });
    setMessage("Disconnected. Export import still works locally.");
  };

  return {
    status,
    syncing,
    message,
    refreshStatus,
    handleSync,
    handleDisconnect,
  };
}
