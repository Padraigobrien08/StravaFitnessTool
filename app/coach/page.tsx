"use client";

import { Suspense, useEffect, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { useSyncPreferences } from "@/hooks/use-sync-preferences";
import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { CoachReasoningWorkspace } from "@/components/coach/coach-reasoning-workspace";
import {
  chatDisabledReason,
  coachHostFromHostname,
  type CoachHost,
} from "@/lib/coach/chatDisabledReason";

function CoachPageInner() {
  const { apiConnected, importData, dataSources } = useStrava();
  const [serverReady, setServerReady] = useState(false);
  const isDemo = Boolean(dataSources.demo);

  // Resolved after mount rather than during render: `window` does not exist on the
  // server, and rendering one wording then swapping to the other is a hydration
  // mismatch. "hosted" is the safer initial value — it never tells a reader to edit a
  // file that is not there.
  const [host, setHost] = useState<CoachHost>("hosted");
  useEffect(() => {
    setHost(coachHostFromHostname(window.location.hostname));
  }, []);

  useSyncPreferences(apiConnected);

  useEffect(() => {
    if (!apiConnected) {
      setServerReady(false);
      return;
    }
    void fetch("/api/me/status", { credentials: "include" })
      .then((r) => r.json())
      .then((s: { connected?: boolean; runs?: number }) => {
        setServerReady(Boolean(s.connected && (s.runs ?? 0) > 0));
      })
      .catch(() => setServerReady(false));
  }, [apiConnected, importData]);

  const chatDisabled = !apiConnected || !serverReady;

  return (
    <RequireData>
      <CoachWorkspace>
        <CoachReasoningWorkspace
          disabled={chatDisabled}
          disabledReason={chatDisabledReason({ isDemo, apiConnected, host })}
        />
      </CoachWorkspace>
    </RequireData>
  );
}

export default function CoachPage() {
  return (
    <Suspense
      fallback={<div className="h-full min-h-[240px] animate-pulse rounded-xl bg-white/[0.02]" />}
    >
      <CoachPageInner />
    </Suspense>
  );
}
