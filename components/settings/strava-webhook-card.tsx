"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PushSubscription {
  id: number;
  callback_url: string;
  application_id: number;
}

export function StravaWebhookCard({ apiConnected }: { apiConnected: boolean }) {
  const [subs, setSubs] = useState<PushSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSubs = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks/strava/subscribe");
      if (!res.ok) return;
      const data = (await res.json()) as { subscriptions?: PushSubscription[] };
      setSubs(data.subscriptions ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (apiConnected) void loadSubs();
  }, [apiConnected, loadSubs]);

  const enableAutoSync = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/webhooks/strava/subscribe", {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        existing?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not enable webhooks");
        return;
      }
      setMessage(
        data.existing
          ? "Webhook already active for your callback URL."
          : "Auto-sync enabled. New Strava activities will sync in the background.",
      );
      await loadSubs();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (!apiConnected) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strava auto-sync (webhooks)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-zinc-400">
        <p>
          Push subscriptions notify this app when you create, update, or delete an activity on
          Strava. Requires a public HTTPS callback URL (e.g. ngrok in dev, your production domain in
          prod).
        </p>
        <p className="text-xs text-zinc-600">
          Set <code className="text-zinc-400">STRAVA_WEBHOOK_CALLBACK_URL</code> to{" "}
          <code className="text-zinc-400">https://your-host/api/webhooks/strava</code> and{" "}
          <code className="text-zinc-400">STRAVA_WEBHOOK_VERIFY_TOKEN</code> in{" "}
          <code className="text-zinc-400">.env.local</code>.
        </p>
        {subs.length > 0 ? (
          <ul className="list-inside list-disc text-zinc-500">
            {subs.map((s) => (
              <li key={s.id} className="truncate">
                Active: {s.callback_url}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-500">No push subscription registered yet.</p>
        )}
        {message ? <p className="text-emerald-400/90">{message}</p> : null}
        {error ? <p className="text-amber-400/90">{error}</p> : null}
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void enableAutoSync()}
        >
          {loading ? "Enabling…" : "Enable auto-sync"}
        </Button>
      </CardContent>
    </Card>
  );
}
